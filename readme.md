# canvasTreeFlow
canvas 树型插件
> typescript + html5   
> 利用 canvas 的高性能绘画, 实现 web 端的树形设计  



## preview

> [点击进入体验](https://helltab.github.io/canvasTreeFlow/index.html)

## startup

```html
<div id='canvasC'></div>
<script src="dist/canvasFlow.js"></script>
<script>
    let flow = new CanvasTreeFlow({
        elem: 'canvasC',
        title_font: '16px 宋体',
        block_font: '14px 楷体',
        onEdit: function (id, draw) {
            if (id) {
                // 修改
                console.log("正在编辑" + id)
            } else {
                // 添加
                console.log("正在添加" + id)
            }
            draw("我是大帅哥我是大帅哥我是大帅哥我是大帅哥我是大帅哥我是大帅哥我是大帅哥")
        },
        onSelect: function (id, type) {
            console.log("选择了", id, type)
        },
        onDel: function (id, draw) {
            console.log("删除了" + id)
            draw(true)
        },
        onAddNode: function (id, ifRoot, preId, draw) {
            console.log("添加了节点" + id, ifRoot)
            draw()
        },
        onAddBlock: function (id, draw) {
            console.log("添加了内容块" + id)
            draw()
        },
        bezier: false // 是否开启贝塞尔连线
    })
</script>
```

## api



