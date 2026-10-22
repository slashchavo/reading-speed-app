import { unzipSync, type Unzipped } from 'fflate';
import type { BookChapter, ParsedBook } from './bookTypes';
import { cleanParagraph, decodeText, normalizeChapters, parseTxtText, resolveZipPath } from './bookUtils';

/**
 * Разбор EPUB и DOCX в браузере. Документы, созданные DOMParser, «инертны»: скрипты не выполняются,
 * картинки и стили не загружаются, а в интерфейс попадает только извлечённый текст.
 */

export class BookParseError extends Error {
  override name = 'BookParseError';
}

const TEXT_FILE = /\.(xml|opf|ncx|xhtml|html|htm|rels)$/i;

function unzipText(bytes: Uint8Array): Unzipped {
  try {
    // Картинки и шрифты не распаковываем — нужен только текст и служебные XML.
    return unzipSync(bytes, { filter: (file) => TEXT_FILE.test(file.name) });
  } catch {
    throw new BookParseError('Файл повреждён или не является архивом EPUB/DOCX.');
  }
}

function readEntry(files: Unzipped, path: string): string | null {
  const entry = files[path] ?? Object.entries(files).find(([name]) => name.toLowerCase() === path.toLowerCase())?.[1];
  return entry ? new TextDecoder('utf-8').decode(entry) : null;
}

function parseXml(source: string): Document | null {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
}

function parseMarkup(source: string): Document {
  const xml = new DOMParser().parseFromString(source, 'application/xhtml+xml');
  if (xml.getElementsByTagName('parsererror').length === 0) return xml;
  return new DOMParser().parseFromString(source, 'text/html');
}

function byLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((el) => el.localName === name);
}

const BLOCKS = new Set([
  'p', 'div', 'section', 'article', 'blockquote', 'li', 'dt', 'dd', 'pre', 'td', 'th', 'tr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'aside', 'figcaption', 'caption',
]);
const SKIP = new Set(['script', 'style', 'head', 'title', 'svg', 'math', 'nav', 'template']);

/** Текст HTML/XHTML-документа по абзацам (блочным элементам). */
export function htmlToParagraphs(doc: Document): { paragraphs: string[]; heading: string | null } {
  const paragraphs: string[] = [];
  let heading: string | null = null;
  let buffer = '';
  const flush = () => {
    const text = cleanParagraph(buffer);
    if (text) paragraphs.push(text);
    buffer = '';
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const name = (node as Element).localName.toLowerCase();
    if (SKIP.has(name)) return;
    if (name === 'br') {
      flush();
      return;
    }
    const block = BLOCKS.has(name);
    if (block) flush();
    if (!heading && /^h[1-3]$/.test(name)) heading = cleanParagraph(node.textContent ?? '') || null;
    node.childNodes.forEach(walk);
    if (block) flush();
  };
  const body = doc.body ?? byLocalName(doc, 'body')[0] ?? doc.documentElement;
  if (body) walk(body);
  flush();
  return { paragraphs, heading };
}

/** Заголовки из оглавления EPUB: путь файла → название раздела. */
function readToc(files: Unzipped, opfPath: string, opf: Document): Map<string, string> {
  const titles = new Map<string, string>();
  const items = byLocalName(opf, 'item');
  const add = (fromFile: string, href: string | null, label: string) => {
    const title = cleanParagraph(label);
    if (!href || !title) return;
    const path = resolveZipPath(fromFile, href);
    if (!titles.has(path)) titles.set(path, title);
  };

  const navItem = items.find((item) => (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav'));
  if (navItem) {
    const navPath = resolveZipPath(opfPath, navItem.getAttribute('href') ?? '');
    const source = readEntry(files, navPath);
    if (source) {
      const nav = parseMarkup(source);
      for (const link of byLocalName(nav, 'a')) add(navPath, link.getAttribute('href'), link.textContent ?? '');
    }
  }

  const spine = byLocalName(opf, 'spine')[0];
  const ncxId = spine?.getAttribute('toc');
  const ncxItem = items.find((item) => item.getAttribute('id') === ncxId || item.getAttribute('media-type') === 'application/x-dtbncx+xml');
  if (ncxItem) {
    const ncxPath = resolveZipPath(opfPath, ncxItem.getAttribute('href') ?? '');
    const source = readEntry(files, ncxPath);
    const ncx = source ? parseXml(source) : null;
    if (ncx) {
      for (const point of byLocalName(ncx, 'navPoint')) {
        const label = byLocalName(point, 'text')[0]?.textContent ?? '';
        const src = byLocalName(point, 'content')[0]?.getAttribute('src') ?? null;
        add(ncxPath, src, label);
      }
    }
  }
  return titles;
}

/** EPUB: container.xml → OPF → spine (порядок чтения) → текст каждого раздела. */
export function parseEpub(bytes: Uint8Array): ParsedBook {
  const files = unzipText(bytes);
  const container = readEntry(files, 'META-INF/container.xml');
  const containerDoc = container ? parseXml(container) : null;
  const opfPath = containerDoc ? byLocalName(containerDoc, 'rootfile')[0]?.getAttribute('full-path') : null;
  if (!opfPath) throw new BookParseError('Не найдено описание книги (container.xml). Возможно, файл повреждён.');
  const opfSource = readEntry(files, opfPath);
  const opf = opfSource ? parseXml(opfSource) : null;
  if (!opf) throw new BookParseError('Не удалось прочитать содержание книги (OPF). Возможно, файл повреждён.');

  const title = cleanParagraph(byLocalName(opf, 'title')[0]?.textContent ?? '') || null;
  const manifest = new Map(
    byLocalName(opf, 'item').map((item) => [item.getAttribute('id') ?? '', item.getAttribute('href') ?? '']),
  );
  const tocTitles = readToc(files, opfPath, opf);
  const chapters: BookChapter[] = [];

  for (const ref of byLocalName(opf, 'itemref')) {
    const href = manifest.get(ref.getAttribute('idref') ?? '');
    if (!href) continue;
    const path = resolveZipPath(opfPath, href);
    const source = readEntry(files, path);
    if (!source) continue;
    const { paragraphs, heading } = htmlToParagraphs(parseMarkup(source));
    chapters.push({ title: tocTitles.get(path) ?? heading ?? '', paragraphs });
  }
  return { title, chapters: normalizeChapters(chapters) };
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function wAttr(el: Element | undefined, name: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W_NS, name) ?? el.getAttribute(`w:${name}`);
}

/** Текст абзаца Word без вложенных абзацев (надписей), которые разбираются отдельно. */
function docxParagraphText(p: Element): string {
  let text = '';
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === 'p' || child.localName === 'txbxContent') continue;
      if (child.localName === 't') text += child.textContent ?? '';
      else if (child.localName === 'tab' || child.localName === 'br' || child.localName === 'cr') text += ' ';
      else walk(child);
    }
  };
  walk(p);
  return text;
}

/** DOCX: word/document.xml, абзацы по порядку; стили «Заголовок/Heading» начинают новые разделы. */
export function parseDocx(bytes: Uint8Array): ParsedBook {
  const files = unzipText(bytes);
  const source = readEntry(files, 'word/document.xml');
  if (!source) throw new BookParseError('В файле нет текста документа Word. Возможно, это не DOCX или файл повреждён.');
  const doc = parseXml(source);
  if (!doc) throw new BookParseError('Не удалось прочитать документ Word. Возможно, файл повреждён.');

  const headingStyles = new Set<string>();
  const stylesSource = readEntry(files, 'word/styles.xml');
  const styles = stylesSource ? parseXml(stylesSource) : null;
  if (styles) {
    for (const style of byLocalName(styles, 'style')) {
      const id = wAttr(style, 'styleId');
      const name = wAttr(byLocalName(style, 'name')[0], 'val') ?? '';
      if (id && /^(heading|заголовок|title|название)/i.test(name)) headingStyles.add(id);
    }
  }

  const coreSource = readEntry(files, 'docProps/core.xml');
  const core = coreSource ? parseXml(coreSource) : null;
  const title = cleanParagraph((core && byLocalName(core, 'title')[0]?.textContent) || '') || null;

  const chapters: BookChapter[] = [{ title: '', paragraphs: [] }];
  for (const p of byLocalName(doc, 'p')) {
    const text = cleanParagraph(docxParagraphText(p));
    if (!text) continue;
    const pPr = Array.from(p.children).find((c) => c.localName === 'pPr');
    const styleId = wAttr(pPr ? byLocalName(pPr, 'pStyle')[0] : undefined, 'val');
    const outline = pPr ? byLocalName(pPr, 'outlineLvl')[0] : undefined;
    const isHeading = (styleId !== null && (headingStyles.has(styleId) || /^heading/i.test(styleId))) || outline !== undefined;
    const current = chapters[chapters.length - 1];
    if (isHeading && current) {
      if (current.paragraphs.length === 0 && !current.title) current.title = text;
      else chapters.push({ title: text, paragraphs: [] });
      continue;
    }
    current?.paragraphs.push(text);
  }
  return { title, chapters: normalizeChapters(chapters) };
}

export function parseTxt(bytes: Uint8Array): ParsedBook {
  return { title: null, chapters: parseTxtText(decodeText(bytes)) };
}
