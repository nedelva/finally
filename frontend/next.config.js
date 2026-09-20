/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true, // pairs with StaticFiles(html=True)'s directory->index.html resolution
};

module.exports = nextConfig;
