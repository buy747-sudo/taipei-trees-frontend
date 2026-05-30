// js/qr.js — jsQR camera scanner

let _qrStream = null;
let _qrRafId = null;

function startQrScanner() {
  const overlay = document.getElementById('qr-overlay');
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');

  overlay.hidden = false;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      _qrStream = stream;
      video.srcObject = stream;
      video.play();
      requestAnimationFrame(scanFrame);
    })
    .catch(() => {
      overlay.hidden = true;
      showToast('無法開啟相機，請確認瀏覽器已允許鏡頭權限');
    });

  function scanFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, canvas.width, canvas.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code) {
        stopQrScanner();
        handleQrResult(code.data);
        return;
      }
    }
    _qrRafId = requestAnimationFrame(scanFrame);
  }
}

function stopQrScanner() {
  if (_qrRafId) { cancelAnimationFrame(_qrRafId); _qrRafId = null; }
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  document.getElementById('qr-overlay').hidden = true;
}

async function handleQrResult(raw) {
  let code = raw;
  try {
    const u = new URL(raw);
    const tid = u.searchParams.get('treeid') || u.searchParams.get('id');
    if (tid) code = tid;
  } catch (_) { /* raw 不是 URL */ }

  const data = await apiFetchTree(code);
  if (data && data.tree) {
    openSheet(data.tree);
    if (data.tree.lat && data.tree.lng) {
      _map.flyTo([data.tree.lat, data.tree.lng], 17);
    }
  } else {
    showToast('找不到此樹籍資料（' + code + '）');
  }
}

function initQr() {
  document.getElementById('scan-btn').addEventListener('click', startQrScanner);
  document.getElementById('qr-close').addEventListener('click', stopQrScanner);
}
