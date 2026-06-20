import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { createHtmlPlugin } from 'vite-plugin-html';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import svgr from "vite-plugin-svgr";
// import { visualizer } from 'rollup-plugin-visualizer';

/**
 * 开启子路由访问
 * 开启后一般外层网管匹配【custom】时直接透传转到内层网关
 * 内层网关访问 api或者前端静态资源需要去掉【custom】前缀
*/
const app_env = { BASE_URL: '' } // /custom

// Use environment variable to determine the target.
const target = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:7860";
const fileServiceTarget = "http://minio:9000";

// 公共代理配置
const commonProxyOptions = {
  changeOrigin: true,
  withCredentials: true,
  secure: false,
  ws: true
};

// 带重写功能的配置生成器
const createProxyConfig = (target, rewrite = true) => ({
  ...commonProxyOptions,
  target,
  ...(rewrite && {
    rewrite: (path) => path.replace(new RegExp(`^${app_env.BASE_URL}`), '')
  }),
  configure: (proxy, options) => {
    proxy.on('proxyReq', (proxyReq, req, res) => {
      console.log('Proxying request to:', proxyReq.path);
    });
  }
});

// API路由配置
const apiRoutes = ["/api/", "/health"];
const apiProxyConfig = createProxyConfig(target);
// 文件服务路由配置
const fileServiceRoutes = ["/eagent", "/tmp-dir"];
const fileServiceProxyConfig = createProxyConfig(fileServiceTarget);

const proxyTargets = {};

// 添加API路由代理
apiRoutes.forEach(route => {
  proxyTargets[`${app_env.BASE_URL}${route}`] = apiProxyConfig;
});
// 添加文件服务路由代理
fileServiceRoutes.forEach(route => {
  proxyTargets[`${app_env.BASE_URL}${route}`] = fileServiceProxyConfig;
});


export default defineConfig(() => {
  return {
    base: app_env.BASE_URL || '/',
    build: {
      // minify: 'esbuild', // 使用 esbuild 进行 Tree Shaking 和压缩
      outDir: "build",
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          manualChunks(id) {
            // 优先处理共享组件
            if (id.includes('components/OnlineConfirmModal')) {
              return 'shared-components';
            }

            if (id.includes('node_modules')) {
              // 注意：ace-builds, react-ace, react-markdown, mathjax 等依赖彼此或被循环引用
              // 不要将它们单独分块，否则会触发 ES module 跨 chunk import 的 TDZ
              // （ReferenceError: Cannot access 'X' before initialization）
              // 统一放入 vendor chunk，让 rollup 在同一模块图内正确排序求值顺序
              if (id.includes('@xyflow/react')) {
                return 'reactflow';
              }
              if (id.includes('pdfjs-dist')) {
                return 'pdfjs';
              }
              if (id.includes('react-window') || id.includes('react-beautiful-dnd') || id.includes('react-dropzone')) {
                return 'reactdrop';
              }

              // 其他 node_modules 包（包括 mathjax-full, rehype-mathjax, ace-builds,
              // react-markdown 等）放入 vendor chunk
              return 'vendor';
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // shared 主题层（platform + client 共用），shared 位于 src/frontend/shared
        '@shared': path.resolve(__dirname, '../shared')
      }
    },
    plugins: [
      react(),
      svgr(),
      createHtmlPlugin({
        minify: true,
        inject: {
          data: {
            // include: [/index\.html$/],
            aceScriptSrc: `<script src="${process.env.NODE_ENV === 'production' ? app_env.BASE_URL : ''}/node_modules/ace-builds/src-min-noconflict/ace.js" type="text/javascript"></script>`,
            baseUrl: app_env.BASE_URL
          }
        }
      }),
      viteStaticCopy({
        targets: [
          {
            src: [
              'node_modules/ace-builds/src-min-noconflict/ace.js',
              'node_modules/ace-builds/src-min-noconflict/mode-json.js',
              'node_modules/ace-builds/src-min-noconflict/worker-json.js',
              'node_modules/ace-builds/src-min-noconflict/mode-yaml.js',
              'node_modules/ace-builds/src-min-noconflict/worker-yaml.js'
            ],
            dest: 'node_modules/ace-builds/src-min-noconflict/'
          },
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
            dest: './'
          }
        ]
      }),
      // 打包物体积报告
      // visualizer({
      //   open: true,
      // })
    ],
    define: {
      __APP_ENV__: JSON.stringify(app_env),
      PACKAGE_VERSION: JSON.stringify('browser'),
    },
    server: {
      host: '0.0.0.0',
      port: 3001,
      proxy: {
        ...proxyTargets,
      },
    },
  };
});
