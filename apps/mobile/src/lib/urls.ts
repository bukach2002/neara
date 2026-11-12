/**
 * React Native's global URL polyfill is not consistently WHATWG-complete across
 * engines, so the session layer uses this small parser instead.
 */
export type ParsedUrl = {
  protocol: 'http:' | 'https:';
  hostname: string;
  port: string | null;
  pathname: string;
};

export function parseHttpUrl(value: string): ParsedUrl {
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)/i.exec(value.trim());
  if (!match) {
    throw new Error('Invalid API URL');
  }

  const protocol = (match[1]?.toLowerCase() === 'https' ? 'https:' : 'http:') as 'http:' | 'https:';
  const authority = match[2] ?? '';
  const withoutUserInfo = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority;

  let hostname = withoutUserInfo;
  let port: string | null = null;

  if (withoutUserInfo.startsWith('[')) {
    const closingBracket = withoutUserInfo.indexOf(']');
    if (closingBracket > 0) {
      hostname = withoutUserInfo.slice(0, closingBracket + 1);
      const remainder = withoutUserInfo.slice(closingBracket + 1);
      port = remainder.startsWith(':') ? remainder.slice(1) : null;
    }
  } else if (withoutUserInfo.includes(':')) {
    const separator = withoutUserInfo.lastIndexOf(':');
    hostname = withoutUserInfo.slice(0, separator);
    port = withoutUserInfo.slice(separator + 1);
  }

  return {
    protocol,
    hostname: hostname.toLowerCase(),
    port: port && port.length > 0 ? port : null,
    pathname: match[3] && match[3].length > 0 ? match[3] : '/',
  };
}

export function originOf(value: string) {
  const parsed = parseHttpUrl(value);
  return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
}
