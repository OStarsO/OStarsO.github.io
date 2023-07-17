// 获取登入表单和输入框
const form1 = document.getElementById("form1");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// 登入成功后的处理
if (username === "admin" && email === "admin@example.com" && password === "password") {
  // 存储登入成功的标记到localStorage
  localStorage.setItem("isLoggedIn", "true");

  // 跳转到OStarsO.html
  window.location.href = "OStarsO.html";
}

// 监听登入表单的提交事件
form1.addEventListener("submit", function(e) {
  e.preventDefault(); // 阻止表单默认提交行为

  // 获取输入框的值
  const username = usernameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;

  // 进行登入验证，这里使用一个简单的示例
  if (username === "admin" && email === "admin@example.com" && password === "password") {
    alert("登入成功");
  } else {
    alert("登入失败，请检查用户名、邮箱和密码");
  }
});
