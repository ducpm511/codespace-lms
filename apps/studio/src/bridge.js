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
  // Tên dự án chờ gắn khi dự án mới (blockspace:new) nạp xong; undefined = không có dự án mới đang chờ.
  var pendingNewTitle;
  var SOURCE_URL = '%SOURCE_URL%';
  // ?mode=player: chỉ sân khấu + cờ xanh (trang xem dự án), không có khu lập trình.
  var PLAYER = new URLSearchParams(window.location.search).get('mode') === 'player';

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

  function setTitle(title) {
    if (typeof title !== 'string') return;
    // Tên dự án là prop có kiểm soát (`projectTitle`, TitledHOC ghi đè Redux bằng prop) → render lại
    // với prop mới; dispatch thêm để vẫn đổi khi prop trùng giá trị cũ mà học viên đã sửa tay.
    renderGui({ projectTitle: title });
    state.dispatch({ type: 'projectTitle/SET_PROJECT_TITLE', title: title });
  }

  function releaseChanges() {
    // loadProject phát vài PROJECT_CHANGED trong lúc nạp — không phải thay đổi của học viên.
    setTimeout(function () {
      suppressChange = false;
    }, 0);
  }

  function load(buffer, title) {
    suppressChange = true;
    return vm
      .loadProject(buffer)
      .then(function () {
        setTitle(title);
        post({ type: 'blockspace:loaded' });
      })
      .catch(function (err) {
        post({ type: 'blockspace:error', message: String((err && err.message) || err) });
      })
      .finally(releaseChanges);
  }

  // Đuôi md5ext → loại asset của scratch-storage.
  var ASSET_TYPES = {
    png: 'ImageBitmap',
    jpg: 'ImageBitmap',
    gif: 'ImageBitmap',
    svg: 'ImageVector',
    wav: 'Sound',
    mp3: 'Sound',
  };

  /**
   * Mở dự án từ LMS: project.json + các asset LMS đã tải (có token) — nạp sẵn vào bộ nhớ của
   * scratch-storage rồi mới loadProject, nên trình soạn KHÔNG phải gọi API. Asset không có trong danh
   * sách (asset thư viện Scratch) vẫn tải từ CDN như bình thường.
   */
  function open(projectJson, assets, title) {
    var storage = vm.runtime.storage;
    (assets || []).forEach(function (a) {
      var parts = String(a.md5ext).split('.');
      var type = ASSET_TYPES[parts[1]];
      if (!type || !(a.data instanceof ArrayBuffer)) return;
      storage.builtinHelper._store(storage.AssetType[type], parts[1], new Uint8Array(a.data), parts[0]);
    });
    suppressChange = true;
    return vm
      .loadProject(projectJson)
      .then(function () {
        setTitle(title);
        post({ type: 'blockspace:loaded' });
      })
      .catch(function (err) {
        post({ type: 'blockspace:error', message: String((err && err.message) || err) });
      })
      .finally(releaseChanges);
  }

  /** Xuất project.json + MỌI asset đang dùng (LMS tự bỏ qua asset server đã có). */
  function exportProject(requestId) {
    var seen = {};
    var assets = [];
    var transfer = [];
    vm.assets.forEach(function (asset) {
      if (!asset || !asset.data) return;
      var md5ext = asset.assetId + '.' + asset.dataFormat;
      if (seen[md5ext]) return;
      seen[md5ext] = true;
      var data = asset.data.slice().buffer; // bản sao — không chuyển quyền bộ nhớ VM đang dùng
      assets.push({ md5ext: md5ext, data: data });
      transfer.push(data);
    });
    post(
      {
        type: 'blockspace:exported',
        requestId: requestId,
        projectJson: vm.toJSON(),
        assets: assets,
        title: projectTitle(),
      },
      transfer,
    );
  }

  /** Dự án mới = dự án mặc định có Rex dựng sẵn trong bundle (như menu Tập tin › Mới). */
  function createNew(title) {
    // Reducer chỉ nhận START_FETCHING_NEW khi đang hiện dự án; lúc khác nó bỏ qua im lặng.
    var loading = state.store.getState().scratchGui.projectState.loadingState;
    if (loading !== 'SHOWING_WITH_ID' && loading !== 'SHOWING_WITHOUT_ID') {
      post({ type: 'blockspace:error', message: 'BlockSpace đang bận, thử lại sau giây lát' });
      return;
    }
    suppressChange = true;
    pendingNewTitle = typeof title === 'string' ? title : null;
    state.dispatch({ type: 'scratch-gui/project-state/START_FETCHING_NEW' });
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
    else if (data.type === 'blockspace:new') createNew(data.title);
    else if (data.type === 'blockspace:open' && typeof data.projectJson === 'string') {
      open(data.projectJson, data.assets, data.title);
    } else if (data.type === 'blockspace:export') {
      try {
        exportProject(data.requestId);
      } catch (err) {
        post({ type: 'blockspace:error', requestId: data.requestId, message: String((err && err.message) || err) });
      }
    } else if (data.type === 'blockspace:save') {
      save(data.requestId).catch(function (err) {
        post({ type: 'blockspace:error', requestId: data.requestId, message: String((err && err.message) || err) });
      });
    }
  });

  function openTab(url) {
    window.open(url, '_blank', 'noopener');
  }

  var appEl = document.getElementById('app');
  GUI.setAppElement(appEl);
  // isPlayerOnly là state Redux của trình soạn (không phải prop) → đặt lúc tạo EditorState.
  var state = new GUI.EditorState({ locale: 'vi', isPlayerOnly: PLAYER });
  var root = GUI.createStandaloneRoot(state, appEl);

  var baseProps = {
    // '0' = dự án mặc định (Rex) dựng sẵn trong bundle. Không có projectId thì trình soạn không nạp
    // gì và không bao giờ gọi onProjectLoaded (bản gốc lấy id từ URL qua HashParserHOC).
    projectId: '0',
    // ADR 003 D2: logo BlockSpace (bản vá 0002 cho thanh menu dùng prop này thay vì logo Scratch).
    logo: './blockspace-logo.svg',
    logoAlt: 'BlockSpace',
    // AGPL-3.0 §13: người dùng qua mạng phải được mời nhận mã nguồn tương ứng của trình soạn.
    onClickAbout: [
      {
        title: 'Mã nguồn BlockSpace',
        onClick: function () {
          openTab(SOURCE_URL);
        },
      },
      {
        title: 'Giấy phép (AGPL-3.0)',
        onClick: function () {
          openTab('./LICENSE.txt');
        },
      },
    ],
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
    // Gọi mỗi khi trình soạn chuyển từ "đang nạp" sang "đang hiện dự án": lần mở đầu và sau mỗi
    // blockspace:new (vm.loadProject trực tiếp KHÔNG đi qua đây).
    onProjectLoaded: function () {
      var boot = document.getElementById('boot');
      if (boot) boot.remove();
      if (pendingNewTitle !== undefined) {
        setTitle(pendingNewTitle === null ? undefined : pendingNewTitle);
        pendingNewTitle = undefined;
        releaseChanges();
        post({ type: 'blockspace:loaded' });
      }
      if (!window.__blockspaceReady) {
        window.__blockspaceReady = true;
        post({ type: 'blockspace:ready' });
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
