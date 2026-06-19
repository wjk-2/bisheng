# CI 配置归档

归档日期：2026-06-19

## 归档原因

本目录下 6 份 CI 配置均为上游 bisheng 项目残留模板，从未在 E-Agent 实际启用，也不适配 E-Agent 的部署形态（E-Agent 镜像在部署机本地构建，不走 DockerHub/Drone）。保留在约定路径会带来误触发风险与命名噪音（dataelement/bisheng-*），故整体移出停用。

## 原文件与原用途

| 归档路径 | 原路径 | 原用途（上游 bisheng） | 为何不用 |
|---|---|---|---|
| github-workflows/base_ci.yml | .github/workflows/base_ci.yml | 构建 backend 基础镜像推 DockerHub | 推 bisheng 官方仓库，无账号必失败 |
| github-workflows/build_linux_only.yml | .github/workflows/build_linux_only.yml | Linux 构建推业务镜像 | 同上 |
| github-workflows/ci.yml | .github/workflows/ci.yml | 主 CI（build/push） | actions v1/v2 老版本，目标仓库不符 |
| github-workflows/release.yml | .github/workflows/release.yml | 发版流水线 | 与 E-Agent 版本节奏无关 |
| github-workflows/test.yml | .github/workflows/test.yml | 测试流水线 | 依赖上游测试矩阵，未启用 |
| drone.yml | .drone.yml | Drone clone 上游 bisheng.git 构建 | E-Agent 无 Drone runner |

## 停用机制

- GHA 仅加载 .github/workflows/*.yml，移出后不再触发。
- Drone 仅识别仓库根 .drone.yml，重命名/移出后不再读取。

## 恢复方式

反向 git mv 即可，并按 E-Agent 实际镜像仓库重写 image/registry/secrets 后启用。
