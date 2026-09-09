// ==== Cấu hình nhanh ====
var CONFIG = {
  remainingSlots: 12,     // số suất còn lại / 50
  unitPrice: 389000,      // giá 1 thảm
  discounts: { 1: 0, 2: 20000, 3: 60000 } // giảm thêm theo số lượng
};

function vnd(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}

// Suất còn lại + thanh tiến trình
(function () {
  var r = Math.max(1, Math.min(50, CONFIG.remainingSlots));
  document.getElementById('remaining').textContent = r;
  document.getElementById('barFill').style.width = Math.max(6, ((50 - r) / 50) * 100) + '%';
})();

// Tổng tiền theo số lượng
var qty = document.getElementById('fQty');
var totalEl = document.getElementById('total');
function updateTotal() {
  var q = parseInt(qty.value, 10) || 1;
  totalEl.textContent = vnd(CONFIG.unitPrice * q - (CONFIG.discounts[q] || 0));
}
qty.addEventListener('change', updateTotal);
updateTotal();

// Gửi đơn
var form = document.getElementById('orderForm');
var submitBtn = form.querySelector('button[type=\"submit\"]');

function showError(msg) {
  alert(msg);
}

form.addEventListener('submit', function (e) {
  e.preventDefault();

  var name = document.getElementById('fName').value.trim();
  var phone = document.getElementById('fPhone').value.trim();
  var address = document.getElementById('fAddress').value.trim();
  var q = parseInt(qty.value, 10) || 1;

  if (!name || !phone || !address) {
    showError('Vui lòng nhập họ tên, số điện thoại và địa chỉ nhận hàng.');
    return;
  }

  var label = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'ĐANG GỬI…';

  fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      phone: phone,
      address: address,
      qty: q,
      // Server tự tính lại tổng; gửi kèm để server phát hiện nếu bảng giá lệch.
      clientTotal: CONFIG.unitPrice * q - (CONFIG.discounts[q] || 0)
    })
  })
    .then(function (res) {
      return res.json().then(function (body) {
        return { status: res.status, body: body };
      });
    })
    .then(function (r) {
      if (!r.body || !r.body.ok) {
        var m = r.body && r.body.error && r.body.error.message;
        showError(m || 'Không gửi được đơn. Vui lòng thử lại hoặc gọi 0393806942.');
        return;
      }
      // Chỉ hiện màn cảm ơn KHI server đã lưu đơn.
      document.getElementById('doneName').textContent = name;
      document.getElementById('formView').hidden = true;
      document.getElementById('doneView').hidden = false;
      document.getElementById('dat-hang').scrollTop = 0;
    })
    .catch(function () {
      showError('Mất kết nối. Vui lòng thử lại hoặc gọi 0393806942.');
    })
    .then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    });
});
