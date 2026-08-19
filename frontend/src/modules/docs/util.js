export function parentOf(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? '' : path.substring(0, i)
}

export function baseName(path) {
  const i = path.lastIndexOf('/')
  return i < 0 ? path : path.substring(i + 1)
}

export function extAllowed(name) {
  return /\.(md|markdown|txt)$/i.test(name)
}
