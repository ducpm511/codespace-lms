/* eslint-disable */
// Pyodide sample-runner worker (T3.8 — PREVIEW ONLY, KHÔNG tính điểm).
// Chạy mã Python của học viên với TỪNG sample stdin trong trình duyệt, so stdout với expectedStdout.
// Điểm chính thức LUÔN do server autograder tính lại (invariant #3 + #5). Worker này chỉ giúp học
// viên tự kiểm nhanh trên sample test (attempt DTO chỉ trả sample — KHÔNG có hidden).
//
// Worker: nạp Pyodide từ asset LOCAL (npm package `pyodide`, phục vụ tại /pyodide/ nhờ
// vite-plugin-static-copy) qua dynamic import ESM — không phụ thuộc CDN lúc runtime.

const PYODIDE_BASE = '/pyodide/';

let pyodideReadyPromise = null;

function loadPyodideOnce() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      const { loadPyodide } = await import(`${PYODIDE_BASE}pyodide.mjs`);
      return await loadPyodide({ indexURL: PYODIDE_BASE });
    })();
  }
  return pyodideReadyPromise;
}

// Mirror server-side normalizeOutput (autograder.types.ts): bỏ khoảng trắng cuối mỗi dòng +
// bỏ các dòng trống ở cuối. Giữ preview khớp với cách chấm chính thức.
function normalizeOutput(s) {
  const lines = String(s)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.join('\n');
}

// Chạy một lần: đặt stdin, capture stdout, exec mã người dùng trong namespace __main__ mới.
async function runOne(pyodide, code, stdin) {
  pyodide.globals.set('_usercode', code);
  pyodide.globals.set('_stdin_data', stdin ?? '');
  const runner = `
import io, contextlib
_out = io.StringIO()
_err = None
_g = {"__name__": "__main__"}
import sys as _sys
_old_stdin = _sys.stdin
_sys.stdin = io.StringIO(_stdin_data)
try:
    with contextlib.redirect_stdout(_out):
        exec(compile(_usercode, "<submission>", "exec"), _g)
except SystemExit:
    pass
except BaseException:
    import traceback
    _err = traceback.format_exc()
finally:
    _sys.stdin = _old_stdin
_result = _out.getvalue()
`;
  await pyodide.runPythonAsync(runner);
  const actualStdout = pyodide.globals.get('_result') ?? '';
  const error = pyodide.globals.get('_err');
  return { actualStdout: String(actualStdout), error: error ? String(error) : null };
}

self.onmessage = async (ev) => {
  const { id, code, samples } = ev.data || {};
  try {
    const pyodide = await loadPyodideOnce();
    const results = [];
    for (const s of samples || []) {
      const { actualStdout, error } = await runOne(pyodide, code, s.stdin);
      const passed = !error && normalizeOutput(actualStdout) === normalizeOutput(s.expectedStdout);
      results.push({
        order: s.order,
        name: s.name ?? null,
        passed,
        actualStdout,
        error,
      });
    }
    self.postMessage({ id, type: 'result', results });
  } catch (e) {
    self.postMessage({ id, type: 'error', error: String((e && e.message) || e) });
  }
};
