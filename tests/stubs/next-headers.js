exports.cookies = () => {
  throw new Error('unexpected cookies() in a unit test')
}
exports.headers = () => {
  throw new Error('unexpected headers() in a unit test')
}
