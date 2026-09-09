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
document.getElementById('orderForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = document.getElementById('fName').value.trim();
  var phone = document.getElementById('fPhone').value.trim();
  var address = document.getElementById('fAddress').value.trim();
  if (!name || !phone || !address) {
    alert('Vui lòng nhập họ tên, số điện thoại và địa chỉ nhận hàng.');
    return;
  }

  // TODO: gửi đơn về server / Google Sheet / CRM của bạn tại đây.
  // Ví dụ:
  // fetch('https://your-endpoint', { method:'POST', headers:{'Content-Type':'application/json'},
  //   body: JSON.stringify({ name:name, phone:phone, address:address, qty:qty.value }) });

  document.getElementById('doneName').textContent = name;
  document.getElementById('formView').hidden = true;
  document.getElementById('doneView').hidden = false;
  document.getElementById('dat-hang').scrollTop = 0;
});
