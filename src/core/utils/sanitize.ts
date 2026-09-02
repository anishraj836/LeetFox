import DOMPurify from 'dompurify';

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'b', 'i', 'strong', 'em', 'strike', 's', 'u', 'sub', 'sup',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'pre', 'code', 'blockquote',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'span', 'div', 'br', 'hr',
      'img', 'a',
      // MathJax & KaTeX tags
      'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'annotation'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'src', 'alt', 'title', 'href', 'target', 'rel',
      'width', 'height', 'colspan', 'rowspan', 'aria-hidden', 'aria-label',
      // MathML attributes
      'display', 'xmlns', 'mathvariant'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus']
  });
}
