/*
 * BlockSpace bridge — dựng trình soạn Scratch (scratch-gui standalone, biến toàn cục `GUI`) và nói
 * chuyện với trang LMS cha qua postMessage. Giao thức: xem README.md.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Cố ý KHÔNG gọi API LMS từ đây: trình soạn không cần token, mọi lưu/tải đi qua trang cha. Nhờ vậy
 * sau này tách trình soạn sang origin riêng chỉ là đổi URL iframe.
 */
(function () {
  'use strict';

  var ORIGIN = window.location.origin;
  var parentWin = window.parent !== window ? window.parent : null;
  var vm = null;
  var suppressChange = false;

  function post(msg, transfer) {
    if (parentWin) parentWin.postMessage(msg, ORIGIN, transfer || []);
  }

  function projectTitle() {
    try {
      return state.store.getState().scratchGui.projectTitle || '';
    } catch (e) {
      return '';
    }
  }

  function load(buffer, title) {
    suppressChange = true;
    return vm
      .loadProject(buffer)
      .then(function () {
        if (typeof title === 'string') {
          // Tên dự án đi theo PROP `projectTitle` (TitledHOC ghi đè Redux bằng prop) → render lại với
          // prop mới; dispatch thêm để vẫn đổi khi prop trùng giá trị cũ mà học viên đã sửa tay.
          renderGui({ projectTitle: title });
          state.dispatch({ type: 'projectTitle/SET_PROJECT_TITLE', title: title });
        }
        post({ type: 'blockspace:loaded' });
      })
      .catch(function (err) {
        post({ type: 'blockspace:error', message: String((err && err.message) || err) });
      })
      .finally(function () {
        // loadProject phát vài PROJECT_CHANGED trong lúc nạp — không phải thay đổi của học viên.
        setTimeout(function () {
          suppressChange = false;
        }, 0);
      });
  }

  function save(requestId) {
    return vm.saveProjectSb3().then(function (blob) {
      return blob.arrayBuffer().then(function (buf) {
        post({ type: 'blockspace:saved', requestId: requestId, sb3: buf, title: projectTitle() }, [buf]);
      });
    });
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== ORIGIN || ev.source !== parentWin || !vm) return;
    var data = ev.data || {};
    if (data.type === 'blockspace:load' && data.sb3 instanceof ArrayBuffer) load(data.sb3, data.title);
    else if (data.type === 'blockspace:save') {
      save(data.requestId).catch(function (err) {
        post({ type: 'blockspace:error', requestId: data.requestId, message: String((err && err.message) || err) });
      });
    }
  });

  // Thanh menu của scratch-gui bỏ qua prop `logo` và tự đặt lại logo Scratch (cả khi đổi "chế độ"
  // màu) → canh thẻ #logo_img và luôn trả về logo BlockSpace (ADR 003 D2: không dùng nhãn Scratch).
  var LOGO = new URL('./blockspace-logo.svg', window.location.href).href;
  new MutationObserver(function () {
    var img = document.getElementById('logo_img');
    if (img && img.src !== LOGO) {
      img.src = LOGO;
      img.alt = 'BlockSpace';
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });

  var appEl = document.getElementById('app');
  GUI.setAppElement(appEl);
  var state = new GUI.EditorState({ locale: 'vi' });
  var root = GUI.createStandaloneRoot(state, appEl);

  var baseProps = {
    // '0' = dự án mặc định dựng sẵn trong bundle. Không có projectId thì trình soạn không nạp gì và
    // không bao giờ gọi onProjectLoaded (bản gốc lấy id từ URL qua HashParserHOC).
    projectId: '0',
    canEditTitle: true,
    canSave: false,
    // false: trong scratch-gui, canCreateNew = "được tạo dự án TRÊN SERVER Scratch" — bật thì dự án
    // chưa có id bị tự lưu lên scratch.mit.edu và báo "Không thể tạo dự án". LMS lo lưu/tạo mới.
    canCreateNew: false,
    backpackVisible: false,
    showComingSoon: false,
    onClickLogo: function () {},
    onVmInit: function (instance) {
      vm = instance;
      vm.on('PROJECT_CHANGED', function () {
        if (!suppressChange) post({ type: 'blockspace:changed' });
      });
    },
    onProjectLoaded: function () {
      var boot = document.getElementById('boot');
      if (boot) boot.remove();
      // Chỉ báo "sẵn sàng" một lần — sau dự án mặc định đầu tiên. Trễ 600 ms: watermark góc khung
      // code bọc ThrottledPropertyHOC(500 ms); nạp dự án của LMS sớm hơn ngưỡng thì cập nhật ảnh bị
      // nuốt và không bao giờ thử lại → watermark kẹt ảnh Mèo. Gốc rễ: bundle npm mang sẵn dự án mặc
      // định có Mèo — bỏ hẳn được khi tự build scratch-gui với dự án mặc định là Rex (T11.0).
      if (!window.__blockspaceReady) {
        window.__blockspaceReady = true;
        setTimeout(function () {
          post({ type: 'blockspace:ready' });
        }, 600);
      }
    },
  };
  var extraProps = {};
  function renderGui(extra) {
    extraProps = Object.assign({}, extraProps, extra);
    root.render(Object.assign({}, baseProps, extraProps));
  }
  renderGui({});
})();
