#!/usr/bin/env bash
# Cloudflare Workers Builds 的构建命令：构建镜像不含 Rust，先装好 Rust 与 wasm-pack 再构建 Web 版。
# 本地已有工具链时会直接跳过安装步骤。
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  echo "==> 安装 Rust（minimal profile）"
  # 直接下载官方 rustup-init（sh.rustup.rs 脚本最终也是下载它），少依赖一个域名
  curl --proto '=https' --tlsv1.2 -sSf -o /tmp/rustup-init \
    https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init
  chmod +x /tmp/rustup-init
  /tmp/rustup-init -y --profile minimal --no-modify-path
fi
# shellcheck disable=SC1091
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "==> 安装 wasm-pack"
  cargo install wasm-pack --locked
fi

echo "==> 构建 Web 版"
pnpm install --frozen-lockfile
pnpm build:web
