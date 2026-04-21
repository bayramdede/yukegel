import type { NextConfig } from "next";

const nextConfig = {
  headers: async () => [
    {
      source: '/',
      headers: [
        { key: 'Cache-Control', value: 'no-store' },
      ],
    },
  ],
};

export default nextConfig;

/** @type {import('next').NextConfig} */

