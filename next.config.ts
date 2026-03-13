import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["chalk", "commander", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
