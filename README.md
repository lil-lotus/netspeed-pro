# ⚡ NetSpeed Pro - 专业网络测速引擎

<p align="center">
  <i>纯前端打造的极致视觉体验，搭载自适应网络探测算法的专业级测速工具！由 <strong>lil-lotus</strong> 荣誉出品 \^o^/</i>
</p>

<p align="center">
  <a href="https://github.com/[你的GitHub用户名]/[你的仓库名]/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  </a>
  <a href="#">
    <img src="https://img.shields.io/badge/Canvas_API-000000?logo=html5&logoColor=white" alt="Canvas">
  </a>
</p>

<p align="center">
  🔗 <b>在线体验：</b> <a href="https://lil-lotus.github.io/netspeed-pro/">👉 点击这里立即测速！</a>
</p>

---

## ✨ 关于项目 (About)

**NetSpeed Pro** 是一个完全基于原生 Web 技术开发的单页面网络诊断工具。它摒弃了传统测速网页的简陋设计，采用了现代感十足的**毛玻璃拟物化 UI** 与**动态 Canvas 图表**。

更硬核的是，其底层测速引擎内置了**智能网络环境感知系统**，能够根据当前网络类型 (1G ~ 6G / WiFi) 自动动态调整测试策略、数据包大小与超时阈值，确保在任何网络环境下都能给出精准、稳定的测速结果。

## 🌟 核心特性 (Features)

### 🎨 极致视觉与交互体验
- **沉浸式全屏 Loading**：优雅的渐变色 Logo 动画与进度条，仪式感拉满。
- **动态 SVG 仪表盘**：平滑过渡的速度指针，实时反映当前测速阶段与数值。
- **Canvas 实时速度曲线**：基于 `requestAnimationFrame` 绘制的高帧率下载/上传速度折线图，支持动态 Y 轴刻度自适应。
- **完全响应式设计**：完美适配桌面端大屏与移动端手机屏幕。

### 🧠 智能自适应测速引擎
- **网络环境自动感知**：通过 `navigator.connection` API 自动识别当前网络等级 (1G/2G/3G/4G/5G/6G/WiFi)，并无缝切换对应的测试配置档位。
- **流式读取 (ReadableStream)**：下载测速采用分块流式读取，实时计算瞬时速度，而非等待文件完全下载，大幅提升测速响应速度与准确度。
- **多级降级与补偿机制**：当主测速节点 (Cloudflare) 超时或受限时，自动降级使用备用节点 (Picsum/Httpbin) 甚至基于 RTT 的智能估算，确保弱网环境下依然能输出有效参考值。
- **全面网络诊断**：不仅测试上下行带宽，还包含 **Ping 延迟、抖动 (Jitter)、丢包率 (Loss)** 的综合评估，并给出「优秀/良好/一般/较差」的智能评级。

### 🛠️ 实用辅助功能
- **一键导出报告**：测速完成后，可生成格式精美的纯文本诊断报告并一键复制到剪贴板（或自动下载为 `.txt` 文件）。
- **本地历史记录**：自动保存最近 8 次测速结果，方便对比网络波动情况。
- **隐私友好**：纯前端运行，IP 与地理位置信息仅用于本次会话展示，不上传至任何私有服务器。

## 🛠️ 技术栈 (Tech Stack)

| 技术 | 说明 |
| :---: | :--- |
| **HTML5 / CSS3** | 语义化结构，CSS Variables，Backdrop-filter 毛玻璃特效，Keyframe 复杂动画 |
| **Vanilla JavaScript** | ES6+ 语法，Async/Await 异步控制，无第三方重型框架依赖，轻量极速 |
| **Canvas 2D API** | 高性能实时数据可视化渲染，支持 Device Pixel Ratio (DPR) 高清屏适配 |
| **Fetch API & Streams** | 利用 `ReadableStream` 实现真正的边下载边测速，配合 `AbortController` 实现精准超时控制 |

## 🚀 本地运行 (Getting Started)

由于项目使用了 `Fetch API` 请求外部测速节点 (如 Cloudflare)，受浏览器 CORS (跨域资源共享) 安全策略限制，**不能直接双击 `index.html` 打开** (`file://` 协议会被拦截)。

请使用以下任一方式在本地运行：

### 方式一：使用 VS Code (强烈推荐)
1. 克隆或下载本仓库到本地。
2. 在 VS Code 中打开该文件夹。
3. 安装 **[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)** 插件。
4. 右键点击 `index.html`，选择 **"Open with Live Server"**。

### 方式二：使用 Python 快速启动
在项目根目录下打开终端，运行以下命令启动本地服务器：
```bash
# Python 3.x
python -m http.server 8000
然后在浏览器中访问：http://localhost:8000
