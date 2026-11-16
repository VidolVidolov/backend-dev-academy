// ui.ts — terminal rendering helpers. Zero dependencies on purpose:
// as a senior frontend dev, notice we're rebuilding "a tiny chalk + a tiny
// markdown renderer" from scratch. Reading this file is lesson #0.

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const wrap = (code: string) => (s: unknown): string => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  italic: wrap('3'),
  underline: wrap('4'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
  bgBlue: wrap('44'),
  bgGreen: wrap('42'),
};

export const symbols = {
  done: c.green('✔'),
  todo: c.gray('○'),
  active: c.yellow('◐'),
  locked: c.gray('🔒'),
  arrow: c.cyan('›'),
  bullet: c.cyan('•'),
};

export function hr(char = '─', width = 60): string {
  return c.gray(char.repeat(width));
}

export function box(title: string): string {
  const line = '━'.repeat(Math.max(title.length + 2, 20));
  return [c.cyan('┏' + line + '┓'), c.cyan('┃ ') + c.bold(title) + c.cyan(' ┃'), c.cyan('┗' + line + '┛')].join('\n');
}

// Extremely small markdown renderer good enough for lesson bodies.
// Supports: # headers, - bullets, `inline code`, ```fenced blocks```,
// **bold**, > blockquotes, and horizontal rules (---).
export function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inFence = false;

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      inFence = !inFence;
      out.push(c.gray(inFence ? '  ┌─ code ' + '─'.repeat(40) : '  └' + '─'.repeat(48)));
      continue;
    }
    if (inFence) {
      out.push(c.gray('  │ ') + c.yellow(raw));
      continue;
    }

    const line = raw;
    // headers
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s/, '');
      if (level === 1) out.push('\n' + c.bold(c.cyan(text.toUpperCase())));
      else if (level === 2) out.push('\n' + c.bold(c.blue(text)));
      else out.push('\n' + c.bold(text));
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      out.push(hr());
      continue;
    }
    if (line.trim().startsWith('> ')) {
      out.push(c.gray('  ┃ ') + c.italic(inline(line.trim().slice(2))));
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^\s*/)![0];
      out.push(indent + symbols.bullet + ' ' + inline(line.replace(/^\s*[-*]\s/, '')));
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      out.push('  ' + inline(line.trim()));
      continue;
    }
    out.push(inline(line));
  }
  return out.join('\n');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, (_, t) => c.bold(t))
    .replace(/`([^`]+)`/g, (_, t) => c.yellow(t))
    .replace(/\*(.+?)\*/g, (_, t) => c.italic(t));
}

export function progressBar(done: number, total: number, width = 24): string {
  const ratio = total === 0 ? 0 : done / total;
  const filled = Math.round(ratio * width);
  const bar = c.green('█'.repeat(filled)) + c.gray('░'.repeat(width - filled));
  return `${bar} ${c.bold(Math.round(ratio * 100) + '%')} ${c.gray(`(${done}/${total})`)}`;
}
