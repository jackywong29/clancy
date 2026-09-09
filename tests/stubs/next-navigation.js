// Any test that reaches these has escaped the pure-logic boundary.
exports.redirect = (url) => {
  throw new Error(`unexpected redirect(${url}) in a unit test`)
}
exports.notFound = () => {
  throw new Error('unexpected notFound() in a unit test')
}
