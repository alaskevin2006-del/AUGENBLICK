# Anvil 课程模板

运行 `python src/anvil/scripts/make_demo.py` 生成 `anvil-demo.zip`，直接在开发者页上传。示例由本项目原创生成，含九种题型、矩阵多子题、连续媒体子题、混合完形、匹配及声音，没有第三方素材许可负担。

解压修改 `course.json` 的标题和界面外课程语言标识，再编辑 `course.xlsx`。A 难度，B 题型编号1–9，C 材料或题干，D 显式问题，E 起为答案选项。第一项是正确答案，运行时会打乱。首行保留表头。完整格式见 `../docs/adr/0001-types-and-source-format.md`。

素材文件放包内，表格填写相对路径。请使用 JPG/PNG/WebP/GIF/BMP、MP3/WAV/M4A/OGG、MP4/WebM；AVI 请先转换。可选单元格朗读例如 `D4.mp3` 放 ZIP 根目录。

学习及测试记录、困难内容、开发者试学都由平台统一管理。不要在表中添加账号、支付或外部 API 密钥。
