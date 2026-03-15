/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/events', destination: '/events.html' },
      { source: '/forums', destination: '/forums.html' },
      { source: '/team', destination: '/team.html' },
      { source: '/accelerator', destination: '/accelerator.html' },
      { source: '/closed-club', destination: '/closed-club.html' }
    ];
  }
};

export default nextConfig;
