export function normalizeSecret(rawValue) {
  let value = String(rawValue || '').trim();
  if (!value) return '';

  // If someone pasted `NAME=value` into the Netlify value box, keep only the value.
  const assignmentMatch = value.match(/^(?:ANTHROPIC_API_KEY|CLAUDE_API_KEY|FAL_KEY|FAL_API_KEY)\s*=\s*(.+)$/s);
  if (assignmentMatch) {
    value = assignmentMatch[1].trim();
  }

  // If someone pasted JSON-ish text, strip obvious wrapping quotes/backticks.
  value = value.replace(/^['"`]+|['"`]+$/g, '').trim();

  // Anthropic keys should not be sent as Bearer tokens when using x-api-key.
  value = value.replace(/^Bearer\s+/i, '').trim();

  // Remove accidental line breaks/spaces that can happen with copy/paste.
  value = value.replace(/[\r\n\t ]+/g, '');

  return value;
}

export function safeSecretSummary(value = '') {
  const normalized = normalizeSecret(value);
  if (!normalized) {
    return {
      present: false,
      length: 0,
      startsWith: '',
      endsWith: '',
      hasEllipsis: false
    };
  }

  return {
    present: true,
    length: normalized.length,
    startsWith: normalized.slice(0, 14),
    endsWith: normalized.slice(-4),
    hasEllipsis: normalized.includes('...')
  };
}

export function readSecretFrom(names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
      const raw = process.env[name];
      const value = normalizeSecret(raw);
      if (value) {
        return {
          name,
          value,
          summary: safeSecretSummary(value)
        };
      }
    }
  }

  return {
    name: null,
    value: '',
    summary: safeSecretSummary('')
  };
}

export function readClaudeApiKey() {
  const found = readSecretFrom(['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY']);

  if (!found.value) {
    throw new Error('Missing Claude API key. In Netlify, add CLAUDE_API_KEY with Functions scope. The value must be the full sk-ant... key.');
  }

  if (found.value.includes('...')) {
    throw new Error(`The Claude key in ${found.name} contains "...", which means a shortened/masked preview was pasted. Create a new key in Claude Console and paste the full key into Netlify.`);
  }

  if (!found.value.startsWith('sk-ant-')) {
    throw new Error(`The Claude key in ${found.name} does not start with sk-ant-. It looks like the wrong value was pasted. Paste only the full Anthropic API key.`);
  }

  return found;
}

export function readFalKey() {
  const found = readSecretFrom(['FAL_KEY', 'FAL_API_KEY']);

  if (!found.value) {
    throw new Error('Missing fal key. In Netlify, add FAL_KEY with Functions scope.');
  }

  if (found.value.includes('...')) {
    throw new Error(`The fal key in ${found.name} contains "...", which means a shortened/masked preview was pasted. Paste the full fal API key into Netlify.`);
  }

  return found;
}

export function envDiagnostics() {
  const claude = readSecretFrom(['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY']);
  const fal = readSecretFrom(['FAL_KEY', 'FAL_API_KEY']);
  const admin = readSecretFrom(['ADMIN_GENERATE_SECRET']);

  return {
    claude: {
      variableFound: claude.name,
      ...claude.summary,
      looksMasked: claude.summary.hasEllipsis,
      looksLikeAnthropicKey: Boolean(claude.value && claude.value.startsWith('sk-ant-'))
    },
    fal: {
      variableFound: fal.name,
      ...fal.summary,
      looksMasked: fal.summary.hasEllipsis
    },
    adminSecret: {
      variableFound: admin.name,
      present: admin.summary.present,
      length: admin.summary.length
    }
  };
}
