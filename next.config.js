/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  api: {
    bodyParser: false,
    responseLimit: '500mb',
  }
}
