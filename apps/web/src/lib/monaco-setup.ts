// Cấu hình @monaco-editor/react nạp Monaco từ bản AMD `min/vs` phục vụ LOCAL tại /monaco/vs
// (copy từ node_modules qua vite-plugin-static-copy) thay vì tải từ CDN. Import file này MỘT LẦN
// (side-effect) trước khi render <Editor>. @monaco-editor/loader tự thiết lập worker theo path này.
import { loader } from '@monaco-editor/react';

loader.config({ paths: { vs: '/monaco/vs' } });
