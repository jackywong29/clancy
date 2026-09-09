// proxy.ts imports NextResponse at module scope; only sessionExpiry is tested,
// and it touches neither.
exports.NextResponse = {
  next: () => {
    throw new Error('unexpected NextResponse.next() in a unit test')
  },
  redirect: () => {
    throw new Error('unexpected NextResponse.redirect() in a unit test')
  },
}
