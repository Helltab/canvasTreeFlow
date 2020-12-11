;
(function (undefined) {
    let _global;
    let LOCAL_KEY = {
        DATA: 'WESTAR_FLOW_DATA'
    };
    const options = {
        initData: null,
        initDataFun: (data) => {
        },
        onEdit: null,
        onSelect: null,
        onDel: (a, b, c) => {
        },
        onAddNode: null,
        onAddBlock: null,
        onSave: res => {
            console.log("--save--");
            sessionStorage.setItem(LOCAL_KEY.DATA, res);
        },
        bezier: false,
        add_btn_h: 40,
        title_h: 180,
        title_w: 340,
        block_h: 120,
        block_w: 340,
        canv_h: 900,
        canv_w: 1600,
        icon_size: 25,
        title_font: '18px Arial',
        block_font: '16px Arial',
        parallel_line: '#e582f1',
        mix_line: '#f39999',
        serial_line: '#8acece',
        active_line: '#419714',
        conn_line_width: 2,
        ELE_GROUP: {
            ADD_NODE_BTN: 'addNodeBtn',
            ADD_BTN: 'addBtn',
            EDIT_BTN: 'editBtn',
            DEL_BTN: 'delBtn',
            OTHER: 'other',
        },
        COLORS: {
            TITLE_BG: '#ffffff',
            BLOCK_BG: '#ffffff',
        }
    };
    let jsRootPath = function () {
        //@ts-ignore
        let jsPath = document.currentScript ? document.currentScript.src : function () {
            let js = document.scripts, last = js.length - 1, src;
            for (let i = last; i > 0; i--) {
                //@ts-ignore
                if (js[i].readyState === 'interactive') {
                    src = js[i].src;
                    break;
                }
            }
            return src || js[last].src;
        }();
        return jsPath.substring(0, jsPath.lastIndexOf('/') + 1);
    }();
    // 图片资源管理器
    const R = {
        edit: { obj: null, src: jsRootPath + '../static/img/btn_edit.svg' },
        del: { obj: null, src: jsRootPath + '../static/img/btn_del.svg' },
        add_block: { obj: null, src: jsRootPath + '../static/img/btn_add_block.svg' },
        add_node: { obj: null, src: jsRootPath + '../static/img/btn_add_node.svg' },
    };
    class CanvasList extends Array {
        constructor(callback, ...items) {
            super(...items);
            this.callback = callback || (() => {
            });
        }
        setSpliceCallback(callback) {
            this.spliceCallback = callback;
        }
        // 只能添加一个
        push(item) {
            this.callback(item);
            return super.push(item);
        }
        splice(start, deleteCount) {
            if (this.spliceCallback) {
                this.spliceCallback(start);
            }
            return super.splice(start, deleteCount);
        }
    }
    class ActNode {
        constructor() {
        }
        /**
         * 绘制当前节点的激活边框
         * @param rect
         */
        drawActBox(rect) {
            let type = 'node';
            if (rect.constructor === CNode) {
                this.lineList = rect.getLineList();
                this.curNode = rect;
                this.curBlock = rect.title;
            }
            else {
                this.curBlock = rect;
                this.curNode = getNodeById(rect.nodeId);
                this.lineList = this.curNode.getLineList();
                type = 'block';
            }
            if (canvasEleArr.indexOf(this.actBox) === -1) {
                this.actBox = new CRect({
                    parent: null,
                    nodeId: this.curNode.id,
                    x: this.curBlock.x,
                    y: this.curBlock.y,
                    height: this.curBlock.height,
                    width: this.curBlock.width,
                    lineWidth: 2,
                    strokeStyle: 'rgb(160,207,255)',
                    radius: this.curBlock.radius
                });
            }
            else {
                arrRemove(canvasEleArr, this.actBox);
                this.actBox.x = this.curBlock.x;
                this.actBox.y = this.curBlock.y;
                this.actBox.radius = this.curBlock.radius;
                this.actBox.height = this.curBlock.height;
                this.actBox.width = this.curBlock.width;
            }
            this.lineList.forEach(line => {
                line.style = line.actStyle;
                line.lineWidth = options.conn_line_width + 1;
            });
            canvasLineArr.forEach(line => {
                if (this.lineList.indexOf(line) === -1) {
                    line.style = line.idStyle;
                    line.lineWidth = options.conn_line_width;
                }
            });
            canvasEleArr.push(this.actBox);
            canvasRedraw();
            if (options.onSelect) {
                options.onSelect(this.curBlock.id, type);
            }
        }
    }
    let realCanv, cacheCtx, cacheCanv, realCtx, canvasEleArr, disableBlockArr, cnodeIdSet, canvasLineArr, canvasNodeArr, curElement, actNode;
    /**
     * 初始化集合数据
     */
    function initContainerData() {
        canvasEleArr = new CanvasList(null);
        disableBlockArr = new CanvasList(null);
        cnodeIdSet = new Set();
        // 连接线的集合, 方便处理当前流程
        canvasLineArr = [];
        canvasNodeArr = new CanvasList(null);
        curElement = null;
        actNode = new ActNode();
        // 节点列表设置回调, 每当节点被删除, 就需要将其下的节点适当上移
        canvasNodeArr.setSpliceCallback(start => {
            let node = canvasNodeArr[start];
            canvasNodeArr.forEach(n => {
                if (n.y > node.y) {
                    // 设置向上修正量, 当前节点的累计增高和下面节点最多能上升的距离中的最小值
                    let offY = Math.min(node.offHeight, n.y - n.preBlock.y + n.preBlock.height / 2);
                    adjustNode(n, 0, offY);
                }
            });
        });
    }
    initContainerData();
    /**
     * 获取节点的所有 ID
     */
    function getNodeIds() {
        return canvasNodeArr.map(x => x.id);
    }
    /**
     * 根据 ID 查找指定节点
     */
    function getNodeById(nodeId) {
        return canvasNodeArr.filter(x => x.id === nodeId)[0];
    }
    /**
     * 根据 ID 查找指定元素
     */
    function getEleById(eleId) {
        return canvasEleArr.filter(x => x.id === eleId)[0];
    }
    /**
     * 调整节点的坐标
     * @param node
     * @param offX
     * @param offY
     */
    function adjustNode(node, offX, offY) {
        if (canvasNodeArr.indexOf(node) === -1) {
            node = null;
            return;
        }
        canvasEleArr.forEach(ele => {
            if (ele.nodeId === node.id) {
                ele.y -= offY;
                ele.x -= offX;
            }
        });
        // 调整完节点需要重置连线
        node.setFromLine();
    }
    /**
     * 删除节点以及其下的所有内容
     * @param node
     */
    function delNode(node) {
        node.delFromLine();
        canvasEleArr.filter(x => x.nodeId === node.id).forEach(ele => {
            arrRemove(canvasEleArr, ele);
        });
        arrRemove(canvasNodeArr, node);
    }
    /**
     * 移除数组中的元素
     * @param arr
     * @param ele
     */
    function arrRemove(arr, ele) {
        let idx = arr.indexOf(ele);
        if (idx !== -1) {
            arr.splice(idx, 1);
        }
    }
    /**
     * 节点的前置, 如果不存在, 则添加一个根节点
     * @param args
     */
    function drawNode(args) {
        args.id = args.id || genUUID();
        let node;
        let title;
        let nodeId = genUUID();
        let preBlock = args.preBlock;
        if (preBlock) {
            let ifRoot = false;
            preBlock.removeGroupEles(options.ELE_GROUP.ADD_NODE_BTN);
            // 如果前置是一个 title, 就将连接按钮移除
            if (preBlock.constructor === CTitle) {
                preBlock.removeGroupEles(options.ELE_GROUP.ADD_NODE_BTN);
                ifRoot = preBlock.ifRoot;
            }
            else {
                setDisableBlock(preBlock);
            }
            let titleX = preBlock.x + preBlock.width + 80;
            let titleY = preBlock.y;
            // 默认是连直线, 如果直线的末端已经有了节点, 就将末端下移到空地
            while (pointInNode(titleX, titleY)) {
                titleY += 60;
            }
            // 先添加一个 title, 除了定位其他都继承前置
            let preNode = getNodeById(preBlock.nodeId);
            title = new CTitle({
                nodeId: nodeId,
                parent: null,
                id: args.id,
                desc: args.desc,
                ifRoot: ifRoot,
                x: titleX,
                y: titleY,
                width: preNode.title.width,
                height: preNode.title.height,
                style: preNode.title.style,
                radius: preNode.title.radius,
            });
            node = new CNode({ title: title, preBlock: preBlock, id: nodeId });
            // 设置内容块的下一个 node
            preBlock.nextNode = node;
            // 设置连接线, 从 root 出来是完全并行, 从其他 title 出来是局部并行, 从 block 出来是串行
            node.setFromLine(new CLine({
                style: ifRoot ? options.parallel_line : (preBlock.constructor === CTitle ? options.mix_line : options.serial_line),
                fromP: new CPoint(preBlock.x + preBlock.width, preBlock.y + preBlock.height / 2),
                toP: new CPoint(title.x, title.y + title.height),
                lineWidth: options.conn_line_width,
                preEle: preBlock
            }));
            // canvasRedraw()
        }
        else {
            // 初始化根节点
            title = new CTitle({
                nodeId: nodeId,
                parent: null,
                ifRoot: true,
                id: args.id,
                desc: args.desc,
                x: 20,
                y: 20,
                width: options.title_w,
                height: options.title_h,
                style: "#ffffff",
                radius: [0, 0, 10, 10],
            });
            node = new CNode({ title: title, id: 'd5bc7bc0f4e64297be363d24842155e9' });
        }
        // 激活当前 node
        actNode.drawActBox(node);
        return node;
    }
    /**
     * 根据位置画出节点
     * @param preBlockId
     * @param preNodeId
     * @param nodeId
     * @param title
     * @param blocks
     * @param list
     */
    function drawNodeByPosition({ preBlockId, preNodeId, nodeId, title, blocks }, list) {
        if (preNodeId && !cnodeIdSet.has(preNodeId)) {
            let preObj = list.filter(x => x.nodeId === preNodeId)[0];
            // 如果有前置, 则递归执行
            preObj && drawNodeByPosition(preObj, list);
        }
        let preBlock = getEleById(preBlockId);
        // 添加标题
        let cTitle = new CTitle(Object.assign(Object.assign({ nodeId: nodeId }, title), { width: options.title_w, height: options.title_h, style: "#ffffff" }));
        let node = new CNode({ title: cTitle, preBlock: preBlock, id: nodeId });
        // 添加内容块
        blocks.forEach((b) => {
            node.addBlock({ id: b.id, desc: b.desc || '节点描述' });
        });
        // 如果有前置内容块, 则画出连接线
        if (preBlockId) {
            let preBlock = getEleById(preBlockId);
            node.preBlock = preBlock;
            if (preBlock.constructor === CTitle) {
                preBlock.removeGroupEles(options.ELE_GROUP.ADD_NODE_BTN);
            }
            else {
                // 如果是内容块, 则需要将内容块之前的连接按钮全部移除 (为了防止连线交叉, 保证节点连接的顺序结构)
                setDisableBlock(preBlock);
            }
            // 设置连接线, 从 root 出来是完全并行, 从其他 title 出来是局部并行, 从 block 出来是串行
            node.setFromLine(new CLine({
                style: title.ifRoot ? options.parallel_line : (preBlock.constructor === CTitle ? options.mix_line : options.serial_line),
                fromP: new CPoint(preBlock.x + preBlock.width, preBlock.y + preBlock.height / 2),
                toP: new CPoint(title.x, title.y + title.height),
                lineWidth: options.conn_line_width,
                preEle: preBlock
            }));
        }
    }
    /**
     * 锁定此前的节点块
     * @param preBlock
     */
    function setDisableBlock(preBlock) {
        getNodeById(preBlock.nodeId).blockList.forEach((b) => {
            if (b.constructor === CBlock && b.y <= preBlock.y && b.disableBlock === null) {
                // 设置本内容块及之前的内容块为禁止状态, 便于随时启用
                b.disableBlock = preBlock;
                disableBlockArr.push(preBlock);
                b.removeGroupEles(options.ELE_GROUP.ADD_NODE_BTN);
            }
        });
    }
    /**
     * 递归激活节点
     * @param block
     */
    function enableBlock(block) {
        let node = getNodeById(block.nodeId);
        node.blockList.forEach(b => {
            if (b.disableBlock === block) {
                b.disableBlock = null;
                node.setAddNodeBtn(b);
            }
        });
    }
    /**
     *
     * @param node
     */
    function getNodeInfo(node) {
        let blocks = [];
        node.blockList.forEach(b => {
            blocks.push({
                x: b.x,
                y: b.y,
                id: b.id,
                desc: b.desc,
            });
        });
        return JSON.stringify({
            title: {
                x: node.title.x,
                y: node.title.y,
                id: node.title.id,
                desc: node.title.desc,
            },
            blocks: blocks,
            nodeId: node.id,
            preNodeId: node.preNode ? node.preNode.id : null
        });
    }
    /**
     * 鼠标按下事件
     * @param e
     */
    function onDown(e) {
        let relation = realCanv.getBoundingClientRect();
        let mx = e.pageX - relation.x;
        let my = e.pageY - relation.y;
        let flag = false;
        curRect(mx, my, ele => {
            if (typeof ele.clickFun === 'function') {
                ele.clickFun(e);
                flag = true;
            }
            curElement = ele;
        });
        // realCanv.addEventListener('mousemove', onMove, false)
        let curNode = pointInNode(mx, my);
        if (curNode) {
            let curBlock = pointInBlock(mx, my);
            if (curBlock) {
                actNode.drawActBox(curBlock);
            }
            else {
                actNode.drawActBox(curNode);
            }
            canvasRedraw();
        }
    }
    /**
     * 检测是否移动
     * @param {Object} e
     */
    function onMove(e) {
        // if (curElement && typeof curElement.dragFun === 'function') {
        //     curElement.dragFun(e)
        // }
        let relation = realCanv.getBoundingClientRect();
        let mx = e.pageX - relation.x;
        let my = e.pageY - relation.y;
        window.scrollTo(mx, my);
    }
    /**
     * 当前元素
     **/
    function curRect(x, y, callback) {
        let rects = canvasEleArr.filter(e => e.__proto__ instanceof CRect).reverse();
        for (let ele of rects) {
            if (x + 5 > ele.x && x - 5 < ele.x + ele.width && y + 10 > ele.y && y - 5 < ele.y + ele.height) {
                callback(ele);
                break;
            }
        }
    }
    /**
     * 是否在节点内部
     ***/
    function pointInNode(x, y, curNode) {
        for (const node of canvasNodeArr) {
            if (curNode && node === curNode)
                continue;
            if (x + 5 > node.x && x - 5 < node.x + node.width && y + 5 > node.y && y - 5 < node.y + node.height) {
                return node;
            }
        }
        return null;
    }
    /**
     * 是否在存在的矩形框内
     ***/
    function pointInBlock(x, y) {
        try {
            for (const block of actNode.curNode.blockList) {
                if (block.constructor === CTitle)
                    continue;
                // if (actNode.curBlock === block) continue
                if (x > block.x && x < block.x + block.width && y > block.y && y < block.y + block.height) {
                    return block;
                }
            }
        }
        catch (e) {
        }
    }
    /**
     * 二分法找文字断开点
     * @param text
     * @param width
     * @return {number}
     */
    function findBreakPoint(text, width) {
        if (!text)
            return 0;
        var min = 0;
        var max = text.length - 1;
        while (min <= max) {
            var middle = Math.floor((min + max) / 2);
            var middleWidth = cacheCtx.measureText(text.substr(0, middle)).width;
            var oneCharWiderThanMiddleWidth = cacheCtx.measureText(text.substr(0, middle + 1)).width;
            if (middleWidth <= width && oneCharWiderThanMiddleWidth > width) {
                return middle;
            }
            if (middleWidth < width) {
                min = middle + 1;
            }
            else {
                max = middle - 1;
            }
        }
        return -1;
    }
    /**
     * 将文字按最大长度分割
     * @param text
     * @param width
     * @param font
     * @return {[]}
     */
    function breakLinesForCanvas(text, width, font) {
        var result = [];
        var breakPoint = 0;
        if (!text) {
            return result;
        }
        if (font) {
            cacheCtx.font = font;
        }
        while ((breakPoint = findBreakPoint(text, width)) !== -1) {
            result.push(text.substr(0, breakPoint));
            text = text.substr(breakPoint);
        }
        if (text) {
            result.push(text);
        }
        return result;
    }
    class CanvasEle {
        constructor(args) {
            addCEle(this);
            this.clickFun = null;
            this.parent = args.parent || null;
            this.nodeId = args.nodeId;
            this.group = args.group || options.ELE_GROUP.OTHER;
            if (args.id && CanvasEle.allIds().indexOf(args.id) !== -1) {
                console.error("id 重复了", args.id);
            }
            this.id = args.id || genUUID();
        }
        addClick(fun) {
            this.clickFun = fun;
        }
    }
    CanvasEle.allIds = function () {
        return canvasEleArr.map(x => x.id);
    };
    /**
     * 矩形类
     */
    class CRect extends CanvasEle {
        constructor(args) {
            super({ parent: args.parent, nodeId: args.nodeId, id: args.id });
            this.x = args.x;
            this.y = args.y;
            this.width = args.width;
            this.height = args.height;
            this.style = args.style;
            this.strokeStyle = args.strokeStyle;
            this.lineWidth = args.lineWidth || 1;
            this.radius = args.radius;
            this.nextNode = args.nextNode;
            this.desc = args.desc;
            this.draw();
        }
        //画矩形
        draw() {
            cacheCtx.beginPath();
            cacheCtx.lineWidth = this.lineWidth;
            if (this.radius) {
                this.drawRoundRectPath(this.radius, this.x, this.y, this.width, this.height);
                if (this.strokeStyle) {
                    cacheCtx.strokeStyle = this.strokeStyle;
                    cacheCtx.stroke();
                }
                else {
                    cacheCtx.fillStyle = this.style;
                    cacheCtx.fill();
                }
            }
            else {
                if (this.strokeStyle) {
                    cacheCtx.lineWidth = this.lineWidth;
                    cacheCtx.strokeStyle = this.strokeStyle;
                    cacheCtx.strokeRect(this.x, this.y, this.width, this.height);
                }
                else {
                    cacheCtx.fillStyle = this.style;
                    cacheCtx.fillRect(this.x, this.y, this.width, this.height);
                }
            }
        }
        addDrag(fun) {
            this.dragFun = fun;
        }
        /**
         * 移除同一组的元素
         */
        removeGroupEles(group) {
            canvasEleArr.filter(x => x.parent === this && x.group === group).forEach(ele => {
                getSubEles(ele, null).forEach(e => {
                    arrRemove(canvasEleArr, e);
                });
            });
        }
        /**
         * 圆角
         * @param radius
         * @param x
         * @param y
         * @param width
         * @param height
         */
        drawRoundRectPath(radius, x, y, width, height) {
            let r0 = radius[0], r1 = radius[1], r2 = radius[2], r3 = radius[3];
            let rb_c_p = new CPoint(width - r0, height - r0).offset(x, y), lb_c_p = new CPoint(r1, height - r1).offset(x, y), lt_c_p = new CPoint(r2, r2).offset(x, y), rt_c_p = new CPoint(width - r3, r3).offset(x, y), b_l_p = new CPoint(r1, height).offset(x, y), l_l_p = new CPoint(0, r2).offset(x, y), t_l_p = new CPoint(width - r3, 0).offset(x, y), r_l_p = new CPoint(width, height - r3).offset(x, y);
            cacheCtx.beginPath();
            //从右下角顺时针绘制，弧度从0到1/2PI
            cacheCtx.arc(rb_c_p.x, rb_c_p.y, r0, 0, Math.PI / 2);
            cacheCtx.lineTo(b_l_p.x, b_l_p.y);
            cacheCtx.arc(lb_c_p.x, lb_c_p.y, r1, Math.PI / 2, Math.PI);
            cacheCtx.lineTo(l_l_p.x, l_l_p.y);
            cacheCtx.arc(lt_c_p.x, lt_c_p.y, r2, Math.PI, Math.PI * 3 / 2);
            cacheCtx.lineTo(t_l_p.x, t_l_p.y);
            cacheCtx.arc(rt_c_p.x, rt_c_p.y, r3, Math.PI * 3 / 2, Math.PI * 2);
            cacheCtx.lineTo(r_l_p.x, r_l_p.y);
            cacheCtx.closePath();
        }
    }
    class CBlock extends CRect {
        constructor(args) {
            super(args);
            this.disableBlock = null;
            this.desc = args.desc || '点击修改节点内容';
        }
    }
    class CBtn extends CRect {
        constructor(args) {
            super(args);
            this.strokeStyle = args.strokeStyle;
            this.lineWidth = args.lineWidth;
            this.group = args.group;
        }
    }
    class CTitle extends CRect {
        constructor(args) {
            args.radius = args.radius || [0, 0, 10, 10];
            super(args);
            this.desc = args.desc || '点击修改标题';
            this.ifRoot = args.ifRoot || false; // 默认 false
            Object.defineProperties(this, {
                _x: {
                    configurable: true,
                    writable: true,
                    value: args.x
                },
                _y: {
                    configurable: true,
                    writable: true,
                    value: args.y
                },
                x: {
                    set(v) {
                        this._x = v;
                        // 将 node 的坐标也重新定位
                        getNodeById(this.nodeId).x = v;
                    },
                    get() {
                        return this._x;
                    }
                },
                y: {
                    set(v) {
                        this._y = v;
                        // 将 node 的坐标也重新定位
                        getNodeById(this.nodeId).y = v;
                    },
                    get() {
                        return this._y;
                    }
                }
            });
        }
    }
    class CText extends CanvasEle {
        constructor(args) {
            super(args);
            this.text = args.text;
            this.fillStyle = args.fillStyle || '#000';
            this.font = args.font;
            this.draw();
        }
        draw() {
            cacheCtx.fillStyle = this.fillStyle;
            cacheCtx.font = this.font;
            // 计算可以显示的坐标和最大宽度
            let textW, textX, textY;
            if (this.parent.width >= 100) {
                textW = this.parent.width - 60;
                textX = this.parent.x + 10;
                textY = this.parent.y + 30;
            }
            else if (this.parent.width >= 40) {
                textW = this.parent.width - 10;
                textX = this.parent.x + 5;
                textY = this.parent.y + 10;
            }
            else {
                textW = this.parent.width * 0.9;
                textX = this.parent.x + 2;
                textY = this.parent.y + 2;
            }
            // 计算换行长度
            breakLinesForCanvas(this.text, textW, this.font).forEach(t => {
                cacheCtx.fillText(t, textX, textY, textW);
                textY += 30;
            });
        }
    }
    class CImg extends CanvasEle {
        constructor(args) {
            super(args);
            this.img = args.img;
            this.width = args.width;
            this.height = args.height;
            this.draw();
        }
        draw() {
            cacheCtx.drawImage(this.img, this.parent.x + (this.parent.width - this.width) / 2, this.parent.y + (this.parent.height - this.height) / 2, this.width, this.height);
        }
    }
    class CLine extends CanvasEle {
        constructor(args) {
            super({ parent: null, nodeId: null, id: args.id });
            this.fromP = args.fromP;
            this.toP = args.toP;
            this.style = args.style;
            this.idStyle = args.style;
            this.lineWidth = args.lineWidth;
            this.preEle = args.preEle;
            this.bezier = args.bezier;
            this.actStyle = options.active_line;
        }
        draw() {
            cacheCtx.beginPath();
            cacheCtx.strokeStyle = this.style;
            cacheCtx.lineWidth = this.lineWidth;
            cacheCtx.moveTo(this.fromP.x, this.fromP.y);
            // 判断是 bezier 还是直线
            if (this.bezier) {
                let offX = (this.toP.x - this.fromP.x) / 10;
                let offY = 0;
                cacheCtx.bezierCurveTo(this.toP.x - offX, this.fromP.y - offY, this.fromP.x + offX, this.toP.y + offY, this.toP.x, this.toP.y);
            }
            else {
                cacheCtx.lineTo(this.toP.x, this.toP.y);
            }
            cacheCtx.stroke();
            addCEle(this);
            return this;
        }
        /**
         * 根据当前线的样式和末尾点坐标进行绘制 fromP可选
         * @param args{fromP,toP}
         */
        drawAsMe(args) {
            return new CLine({
                fromP: args.fromP || this.toP,
                toP: args.toP,
                style: this.style,
                lineWidth: this.lineWidth,
                preEle: this,
            }).draw();
        }
    }
    function genUUID() {
        var d = new Date().getTime();
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now(); //use high-precision timer if available
        }
        var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }
    class CPoint {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        offsetNew(offx, offy) {
            return new CPoint(this.x + offx, this.y + offy);
        }
        setP(x, y) {
            this.x = x;
            this.y = y;
        }
        offset(offx, offy) {
            this.x += offx;
            this.y += offy;
            return this;
        }
    }
    /**
     * 每一组元素都可以逻辑归纳为一个节点
     */
    class CNode {
        constructor(args) {
            this.offHeight = 0; // 挤压下方方框的高度
            this.title = args.title;
            this.preBlock = args.preBlock || null;
            this.id = args.id || genUUID();
            this.preNode = args.preBlock ? getNodeById(args.preBlock.nodeId) : null;
            this.preNodeId = this.preNode ? this.preNode.id : null;
            this.preBlockId = this.preBlock ? this.preBlock.id : null;
            this.listfromLine = new CanvasList(null);
            // 注册到全局的 node 的列表中
            canvasNodeArr.push(this);
            // 注册到全局的 nodeIdSet 中
            cnodeIdSet.add(this.id);
            Object.defineProperties(this, {
                '_x': {
                    configurable: true,
                    writable: true,
                    value: 0
                },
                '_y': {
                    configurable: true,
                    writable: true,
                    value: 0
                },
                '_height': {
                    configurable: true,
                    writable: true,
                    value: 0
                },
                '_width': {
                    configurable: true,
                    writable: true,
                    value: 0
                },
                x: {
                    get() {
                        this.widthModify(this._x, this._width);
                        return this._x;
                    },
                    set(v) {
                        this._x = v;
                    }
                },
                y: {
                    get() {
                        this.heightModify(this._y, this._height);
                        return this._y;
                    },
                    set(v) {
                        this._y = v;
                    }
                },
                width: {
                    get() {
                        this.widthModify(this._x, this._width);
                        return this._width;
                    },
                    set(v) {
                        this._width = v;
                    }
                },
                height: {
                    get() {
                        this.heightModify(this._y, this._height);
                        return this._height;
                    },
                    set(v) {
                        this._height = v;
                    }
                }
            });
            if (args.title) {
                this.setTitle(args.title);
            }
        }
        widthModify(x, width) {
            // 调整画布宽度
            if (width + x > realCanv.width - 30) {
                realCanv.width += width + 100;
                cacheCanv.height = realCanv.height;
                cacheCanv.width = realCanv.width;
                canvasRedraw();
            }
        }
        heightModify(y, height) {
            // 调整画布高度
            if (height + y > realCanv.height - 30) {
                realCanv.height += this.title.height + 100;
                cacheCanv.height = realCanv.height;
                cacheCanv.width = realCanv.width;
            }
        }
        /**
         * 设置标题框
         * @param title
         */
        setTitle(title) {
            title.nodeId = this.id;
            this.x = title.x;
            this.y = title.y;
            this.width = title.width;
            this.height = title.height + 40; // 加上 addBtn 的高度
            this.blockList = new CanvasList(b => {
                if (b === title)
                    return;
                // 将 node 的高度往下扩展
                this.height += b.height + 5;
            });
            this.blockList.setSpliceCallback(start => {
                let disabledBlock = this.blockList[start];
                this.blockList.forEach(b => {
                    if (b !== disabledBlock && b.disableBlock === disabledBlock) {
                        this.setAddNodeBtn(b);
                        disableBlockArr.splice(disableBlockArr.indexOf(b.disableBlock), 1);
                        b.disableBlock = null;
                    }
                });
                this.height -= options.block_h + 5;
                // actNode.drawActBox(this)
            });
            this.blockList.push(title);
            this.setText(title, title.desc);
            this.setAddBtn();
            if (canvasNodeArr.length > 1) {
                this.setDelBtn(title);
                this.setEditBtn(title, false);
            }
            else {
                // 第一个节点不允许删除
                this.setEditBtn(title, true);
            }
            this.setAddNodeBtn(title);
            /*this.title.addDrag(e => {
                let x = e.pageX
                let y = e.pageY
                console.log(x, y)
                if (this.canvasLastP) {
                    this.title.x += x - this.canvasLastP.x
                    this.title.y += y - this.canvasLastP.y
                    canvasRedraw()
                }
                this.canvasLastP = new CPoint(x, y)
            })*/
        }
        /**
         * 设置文本
         * @param rect
         * @param text
         */
        setText(rect, text) {
            rect.contentTextId = new CText({
                text: text,
                parent: rect,
                nodeId: rect.nodeId,
                font: rect.constructor === CTitle ? options.title_font : options.block_font,
            }).id;
        }
        setAddBtn() {
            let preBlock = this.getPreBlock();
            let addBtnX = preBlock.x;
            let addBtnY = preBlock.y + preBlock.height;
            let addBtnH = 40;
            let addBtnW = preBlock.width;
            if (this.addBtn) {
                this.title.removeGroupEles(options.ELE_GROUP.ADD_BTN);
            }
            if (pointInNode(addBtnX, addBtnY + addBtnH, this)) {
                // 将所有 y 大于当前的并且 x 大于等于当前的都往下移动
                for (const node of canvasNodeArr) {
                    if (node !== this && node.y > this.y && node.x >= this.x) {
                        let offY = this.title.height;
                        this.offHeight += offY;
                        canvasEleArr.forEach(ele => {
                            if (ele.nodeId === node.id && ele.y !== undefined) {
                                ele.y += offY;
                            }
                        });
                        node.setFromLine(null, node.preBlock);
                    }
                }
                // canvasRedraw()
                actNode.drawActBox(this);
            }
            this.addBtn = new CBtn({
                nodeId: this.id,
                parent: this.title,
                x: addBtnX,
                y: addBtnY,
                width: addBtnW,
                height: addBtnH,
                group: options.ELE_GROUP.ADD_BTN,
                style: this.title.style,
                radius: [10, 10, 0, 0]
            });
            new CImg({
                parent: this.addBtn,
                nodeId: this.id,
                img: R.add_block.obj,
                width: 30,
                group: options.ELE_GROUP.ADD_BTN,
                height: 30,
            });
            this.addBtn.clickFun = e => {
                if (options.onAddBlock) {
                    let id = genUUID();
                    actNode.drawActBox(this);
                    options.onAddBlock(id, (desc) => {
                        this.addBlock({ id: id, desc: desc || '节点描述' });
                        afterEvent();
                    });
                }
                else {
                    console.error("e.add.null 未找到内容块添加事件");
                }
            };
        }
        setAddNodeBtn(rect = this.title) {
            let addNodeBtn = new CBtn({
                parent: rect,
                nodeId: this.id,
                group: options.ELE_GROUP.ADD_NODE_BTN,
                x: rect.x + rect.width + 2,
                y: rect.y + rect.height / 2 - 14,
                width: 28,
                height: 40,
                style: '#fff',
                strokeStyle: 'rgb(160,207,255)',
                radius: [5, 0, 0, 5]
            });
            new CBtn({
                parent: rect,
                nodeId: this.id,
                x: rect.x + rect.width - 2,
                y: rect.y + rect.height / 2 - 13,
                group: options.ELE_GROUP.ADD_NODE_BTN,
                width: 30,
                height: 38,
                style: '#fff',
                radius: [5, 0, 0, 5]
            }).addClick(() => {
                if (options.onAddNode) {
                    let id = genUUID();
                    options.onAddNode(id, rect.ifRoot, rect.id, (desc = '点击修改标题') => {
                        drawNode({ id: id, preBlock: rect, desc: desc });
                        afterEvent();
                    });
                }
                else {
                    console.error("e.add.null 未找到节点添加事件");
                }
            });
            new CImg({
                parent: addNodeBtn,
                nodeId: this.id,
                group: options.ELE_GROUP.ADD_NODE_BTN,
                img: R.add_node.obj,
                width: options.icon_size,
                height: options.icon_size,
            });
        }
        /**
         * 绘制删除按钮
         * @param rect
         */
        setDelBtn(rect) {
            let delBtn = new CBtn({
                parent: rect,
                nodeId: this.id,
                x: rect.x + rect.width - 40,
                y: rect.y + 20,
                group: options.ELE_GROUP.DEL_BTN,
                width: options.icon_size,
                height: options.icon_size,
                style: 'rgba(225,225,225,0.01)'
            });
            new CImg({
                parent: delBtn,
                nodeId: this.id,
                group: options.ELE_GROUP.DEL_BTN,
                img: R.del.obj,
                width: options.icon_size,
                height: options.icon_size,
            });
            delBtn.clickFun = e => {
                if (options.onDel) {
                    let ifTitle = rect.constructor === CTitle;
                    let type = ifTitle ? 'title' : 'block';
                    if (!ifTitle) {
                        setTimeout(() => {
                            actNode.drawActBox(getNodeById(rect.nodeId));
                        }, 0);
                    }
                    options.onDel(rect.id, type, () => {
                        this.delRect(rect);
                        afterEvent();
                    });
                }
                else {
                    console.error("e.del.null 未添加删除事件");
                }
            };
        }
        /**
         * 递归获取子节点
         * @param node
         * @param list
         */
        getSubNode(node, list) {
            let temp = canvasNodeArr.filter(x => x.preNode === node);
            if (!list)
                list = [node];
            list = [...temp, ...list];
            if (temp.length === 0)
                return list;
            for (const e of temp) {
                list = this.getSubNode(e, list);
            }
            return list;
        }
        /**
         * 递归获取当前流程的连接线
         * @param node
         * @param list
         */
        getLineList(node = this, list) {
            if (!list)
                list = [];
            if (!node || node.title.ifRoot)
                return list;
            list = [...list, ...node.listfromLine];
            return this.getLineList(node.preNode, list);
        }
        /**
         * 递归删除节点
         * @param rootNode
         */
        delNode(rootNode) {
            this.getSubNode(rootNode).forEach(node => {
                node.delFromLine();
                canvasEleArr.filter(x => x.nodeId === node.id).forEach(x => {
                    arrRemove(canvasEleArr, x);
                });
                arrRemove(canvasNodeArr, node);
            });
        }
        /**
         * 删除 block
         * @param rect
         */
        delRect(rect) {
            // 如果是 title, 就是删除整个节点
            if (rect.constructor === CTitle) {
                let curNode = getNodeById(rect.nodeId), freeX = curNode.x, nextNode = rect.nextNode, preBlock = curNode.preBlock;
                // 先删除连接线
                curNode.delFromLine();
                // 设置当前激活节点为上一个
                actNode.drawActBox(curNode.preNode);
                // 如果是局部并行节点, 直接删除所有
                // 注意, 此处的 preBlock 必定是不为空的
                if (preBlock.constructor === CBlock) {
                    this.delNode(curNode);
                    enableBlock(curNode.preBlock);
                    return;
                    // 如果是完全并行节点, 只删除该节点和其下的串行子节点
                }
                else {
                    // 如果存在串行子节点
                    if (nextNode) {
                        let flag = true;
                        for (let node of canvasNodeArr) {
                            // 如果下面有 node, 则需要将下一个 node 的线延长, 没有的话, 就将右边的所有元素向左平移
                            if (curNode !== node && node.x > freeX - 20 && node.x < freeX + 20) {
                                flag = false;
                                break;
                            }
                        }
                        if (flag) {
                            // 递归调整横向位置和连线
                            this.getSubNode(nextNode, null).forEach(node => {
                                canvasEleArr.filter(x => x.nodeId === node.id).forEach(ele => {
                                    let eleNode = getNodeById(ele.nodeId);
                                    if (ele.x)
                                        ele.x -= (curNode.width + eleNode.fromLine.toP.x - eleNode.fromLine.fromP.x);
                                });
                                node.setFromLine(null, node.preNode === curNode ? curNode.preBlock : null);
                            });
                        }
                        else {
                            // 将下一个节点连到上一个节点
                            nextNode.setFromLine(null, curNode.preBlock);
                        }
                        // 调整连接
                        nextNode.preNode = curNode.preNode;
                        nextNode.preBlock = curNode.preNode.title;
                        curNode.preNode.title.nextNode = nextNode;
                    }
                    else { //如果不存在子节点, 直接删除前置的 nextNode, 并添加前置节点的连接按钮
                        curNode.preNode.title.nextNode = null;
                        curNode.preNode.setAddNodeBtn(curNode.preBlock);
                    }
                }
                /**
                 * 删除当前 node
                 */
                canvasEleArr.filter(x => x.nodeId === rect.nodeId).filter(x => {
                    arrRemove(canvasEleArr, x);
                });
                arrRemove(canvasNodeArr, getNodeById(rect.nodeId));
            }
            else {
                let rectNode = getNodeById(rect.nodeId);
                if (rect.nextNode) {
                    // 递归删除所有的节点
                    this.getSubNode(rect.nextNode, null).forEach(node => {
                        delNode(node);
                    });
                    rect.nextNode = null;
                }
                let offH = rect.height + 5;
                // 移除内容块
                arrRemove(this.blockList, rect);
                getSubEles(rect, null).forEach(ele => {
                    arrRemove(canvasEleArr, ele);
                });
                /**
                 * 如果下方有 node, 可以将其上移
                 * 1. 正下方或右下方
                 * 2. 节点调整后的位置应该低于当前节点底部
                 * 3. 节点调整后的位置应该低于前置右中点
                 */
                canvasNodeArr.filter(node => node.id !== rect.nodeId
                    && node.x >= rect.x
                    && node.y - rect.height > rectNode.y + rectNode.height
                    && node.y - rect.height >= node.preBlock.y + node.preBlock.height / 2)
                    .forEach(node => {
                    adjustNode(node, 0, rect.height);
                });
                // 遍历位于其下的内容块, 递归调整后继节点
                this.blockList.forEach(block => {
                    if (block.y > rect.y) {
                        getSubEles(block).forEach(ele => {
                            ele.y -= offH;
                            if (ele.nextNode) {
                                this.getSubNode(ele.nextNode, null).forEach(node => {
                                    adjustNode(node, 0, Math.min(offH, node.y - node.preBlock.y));
                                });
                            }
                        });
                    }
                });
                this.setAddBtn();
            }
        }
        /**
         * 设置修改按钮
         * @param rect
         * @param root
         */
        setEditBtn(rect, root) {
            let offY = root ? rect.y + 20 : rect.y + rect.height * 0.5;
            let editBtn = new CBtn({
                parent: rect,
                nodeId: this.id,
                x: rect.x + rect.width - 40,
                y: offY,
                width: options.icon_size,
                height: options.icon_size,
                style: "rgba(255,255,255, 0.01)",
            });
            let editImg = new CImg({
                parent: editBtn,
                nodeId: this.id,
                img: R.edit.obj,
                width: options.icon_size,
                height: options.icon_size,
            });
            editBtn.clickFun = e => {
                let content = getEleById(rect.contentTextId) || null;
                let type = rect.constructor === CTitle ? 'title' : 'block';
                if (options.onEdit) {
                    actNode.drawActBox(rect);
                    options.onEdit(rect.id, type, (text) => {
                        rect.desc = text;
                        if (content) {
                            content.text = text;
                        }
                        else {
                            this.setText(rect, text);
                        }
                        afterEvent();
                    });
                }
            };
        }
        /**
         * 删除连接线, 还原连接按钮
         */
        delFromLine() {
            this.listfromLine.forEach(l => {
                arrRemove(canvasEleArr, l);
                l = null;
            });
        }
        /**
         * 设置过来的路径
         * @param line
         * @param preEle
         *
         **/
        setFromLine(line, preEle) {
            if (line) {
                this.fromLine = line;
            }
            else {
                if (!this.fromLine) {
                    return;
                }
                line = this.fromLine;
            }
            // 如果 list 有线, 置空并从元素列表和连线列表中移除(也从画面中移除了)
            if (this.listfromLine.length > 0) {
                this.listfromLine.forEach(l => {
                    arrRemove(canvasEleArr, l);
                    arrRemove(canvasLineArr, l);
                });
                this.listfromLine = new CanvasList(null);
            }
            // 如果没有传前置, 则默认原则当前 node 的前置
            preEle = preEle ? preEle : this.preBlock;
            // 连线开始端设置为前置的右中点
            line.fromP.setP(preEle.x + preEle.width, preEle.y + preEle.height / 2);
            this.fromX = preEle.x + preEle.width;
            this.fromY = preEle.y + preEle.height / 2;
            // 连线末端设置为当前节点 title 的左中点
            line.toP.setP(this.title.x, this.title.y + this.title.height / 2);
            // 如果开始端和末端水平, 则画直线
            if (line.fromP.y === line.toP.y) {
                line.draw();
                addCEle(line);
                this.listfromLine.push(line);
                // 不平行则画三条折线或者是贝塞尔曲线 bezier
            }
            else if (line.toP.y > line.fromP.y) {
                arrRemove(canvasEleArr, line);
                // 计算转折点横坐标
                if (options.bezier) { // 是否启用贝塞尔曲线
                    line.bezier = true;
                    this.listfromLine.push(line.draw());
                }
                else { // 三条折线
                    let midx = (line.fromP.x + line.toP.x) / 2;
                    let line1 = line.drawAsMe({
                        fromP: new CPoint(line.fromP.x, line.fromP.y),
                        toP: new CPoint(midx, line.fromP.y),
                    });
                    let line2 = line1.drawAsMe({
                        toP: new CPoint(midx, line.toP.y),
                    });
                    let line3 = line2.drawAsMe({
                        toP: new CPoint(line.toP.x, line.toP.y),
                    });
                    this.listfromLine.push(line1);
                    this.listfromLine.push(line2);
                    this.listfromLine.push(line3);
                }
            }
            // 更新连线集合
            canvasLineArr = [...canvasLineArr, ...this.listfromLine];
        }
        /**
         * 添加内容段
         */
        addBlock({ id = genUUID(), desc }) {
            let preBlock = this.getPreBlock();
            let block = new CBlock({
                id: id,
                nodeId: this.id,
                parent: null,
                x: preBlock.x,
                y: preBlock.y + preBlock.height + 5,
                width: preBlock.width,
                height: 120,
                desc: desc,
                style: "#ffffff",
            });
            this.blockList.push(block);
            this.setText(block, block.desc);
            this.setEditBtn(block);
            this.setDelBtn(block);
            this.setAddNodeBtn(block);
            this.setAddBtn();
            actNode.drawActBox(block);
            return block;
        }
        /**
         * 获取前一个内容块, 如果没有, 就返回 title
         * @return {*}
         */
        getPreBlock() {
            return this.blockList[this.blockList.length - 1];
        }
    }
    /**
     * 递归获取子元素
     * @param ele
     * @param list
     */
    function getSubEles(ele, list) {
        let temp = canvasEleArr.filter(x => x.parent === ele);
        if (!list)
            list = [ele];
        list = [...temp, ...list];
        if (temp.length === 0)
            return list;
        for (const e of temp) {
            list = getSubEles(e, list);
        }
        return list;
    }
    /**
     * 添加元素
     * @param {Object} ele
     */
    function addCEle(ele) {
        if (!canvasEleArr)
            canvasEleArr = new CanvasList(null);
        if (canvasEleArr.indexOf(ele) === -1)
            canvasEleArr.push(ele);
    }
    function afterEvent() {
        canvasRedraw();
        if (options.onSave) {
            let data = JSON.stringify(getData());
            options.onSave(data);
        }
        else {
            console.error("e.save, 保存失败, 未找到 onSave");
        }
    }
    function saveCanvas() {
    }
    function loadCanvas() {
        const result = {
            root: {
                id: '1',
                desc: 'root',
                next: '2',
                blockList: [
                    { id: '101', next: '3', desc: 'b_101' },
                    { id: '102', desc: 'b_102' },
                    { id: '103', desc: 'b_103' },
                ]
            },
            nodeList: [{
                    id: '2',
                    desc: 'n_2',
                    blockList: [
                        { id: '201', desc: 'b_201' },
                    ]
                }, {
                    id: '3',
                    title: 'n_3',
                    blockList: [
                        { id: '301', desc: 'b_301' },
                    ]
                },
            ]
        };
        clearScreen();
        let root = drawNode({ id: result.root.id, desc: result.root.desc });
        result.root.blockList.forEach(b => {
            root.addBlock(b);
        });
        let nextObj = result.nodeList.filter(node => node.id = result.root.next)[0];
        let next = drawNode({ id: nextObj.id, desc: nextObj.desc, preBlock: root.title });
        nextObj.blockList.forEach(b => {
            next.addBlock(b);
        });
        result.nodeList.forEach(node => {
        });
        canvasRedraw();
    }
    /**
     * 将持久化的数据进行重绘
     */
    function drawNodeList(nodes = JSON.parse(sessionStorage.getItem(LOCAL_KEY.DATA))) {
        try {
            if (!nodes || nodes.length < 0)
                return;
            clearScreen();
            initContainerData();
            nodes.forEach(node => {
                drawNodeByPosition(node, nodes);
            });
            canvasRedraw();
        }
        catch (e) {
            console.log("数据加载失败");
        }
    }
    /**
     * 重绘
     */
    function canvasRedraw() {
        cacheCtx.clearRect(0, 0, realCanv.width, realCanv.height);
        cacheCtx.fillStyle = "#ddd";
        cacheCtx.fillRect(0, 0, realCanv.width, realCanv.height);
        canvasEleArr.forEach(ele => {
            ele.draw();
        });
        display();
    }
    function display() {
        realCtx.clearRect(0, 0, realCanv.width, realCanv.height);
        realCtx.fillStyle = "#ddd";
        realCtx.fillRect(0, 0, realCanv.width, realCanv.height);
        //双缓冲绘图, 将缓冲区的画面显示到页面
        realCtx.drawImage(cacheCanv, 0, 0);
    }
    function clearScreen() {
        realCtx.clearRect(0, 0, realCanv.width, realCanv.height);
        realCtx.fillRect(0, 0, realCanv.width, realCanv.height);
    }
    /**
     * 主体类
     */
    class CanvasTreeFlow {
        constructor(args) {
            this.loadCanvas = loadCanvas;
            this.saveCanvas = saveCanvas;
            this.genUUID = genUUID;
            Object.assign(options, args);
            this.elem = args.elem || 'canvasTreeFlow';
            this.initId = args.initId || genUUID();
            // 加载图片
            this.loadR();
        }
        loadR() {
            let num = 4, i = 0;
            for (let k in R) {
                R[k].obj = new Image();
                R[k].obj.src = R[k].src;
                R[k].obj.onload = () => {
                    i++;
                    // console.log('图片', k, '已经加载成功')
                    if (i === num) {
                        // console.log('图片全部加载成功')
                        if (options.initData) {
                            this.init();
                            drawNodeList(JSON.parse(options.initData));
                        }
                        else {
                            initContainerData();
                            this.init();
                            options.initDataFun(getData());
                        }
                    }
                };
            }
        }
        /**
         * 初始化一个默认的节点
         * 1. 在指定的 div 下生成两个 canvas, 一个用来显示, 一个用来生成缓存图标, 构成双缓冲
         * 2. 为展示 canvas 添加点击事件监听
         * 3. 画一个默认的节点, 包括: title, editBtn, addBtn (第一个节点是不允许删除的..)
         * 4. 通过 display 的双缓冲转换显示到页面中
         */
        init() {
            let pBox = document.getElementById(this.elem);
            pBox.style.width = (options.canv_w + 8) + 'px';
            pBox.style.height = (options.canv_h + 8) + 'px';
            pBox.style.overflow = 'auto';
            realCanv = document.createElement("canvas");
            realCanv.id = this.elem + '_real_canvas';
            realCanv.width = options.canv_w;
            realCanv.height = options.canv_h;
            realCtx = realCanv.getContext("2d");
            realCtx.fillStyle = "#ddd";
            realCtx.fillRect(0, 0, options.canv_w, options.canv_h);
            // 点击事件
            realCanv.addEventListener("mousedown", onDown);
            // 双击事件
            realCanv.addEventListener("dblclick", e => {
                e.preventDefault();
            });
            // 鼠标点击抬起事件
            realCanv.addEventListener("mouseup", () => {
                realCanv.removeEventListener('mousemove', onMove, false);
            });
            cacheCanv = document.createElement("canvas");
            cacheCanv.style.display = 'none';
            cacheCanv.width = realCanv.width;
            cacheCanv.id = `cache_${this.elem}`;
            cacheCanv.height = realCanv.height;
            pBox.appendChild(realCanv);
            pBox.appendChild(cacheCanv);
            cacheCtx = cacheCanv.getContext('2d');
            drawNode({ id: this.initId });
            // display()
            canvasRedraw();
        }
        reload(treeData) {
            if (!treeData || !treeData.canvasEleArr || !treeData.canvasNodeArr) {
                alert("参数有误, 不能重新加载");
                return;
            }
            canvasEleArr = treeData.canvasEleArr;
            canvasNodeArr = treeData.canvasNodeArr;
            canvasRedraw();
        }
    }
    /**
     * 判断某个示例是否是属于哪个类
     * @param obj
     * @param type
     */
    function isType(obj, type) {
        return obj.__proto__.constructor === type;
    }
    /**
     * 获取当前绘画区数据
     */
    function getData() {
        let resList = [];
        canvasNodeArr.forEach(node => {
            let title = node.title;
            let blocks = [];
            node.blockList.forEach(b => {
                if (!isType(b, CTitle)) {
                    blocks.push({ x: b.x, y: b.y, id: b.id, desc: b.desc, group: b.group });
                }
            });
            resList.push({
                title: { x: title.x, y: title.y, ifRoot: title.ifRoot, id: title.id, desc: title.desc },
                blocks,
                nodeId: node.id,
                preNodeId: node.preNodeId,
                preBlockId: node.preBlockId
            });
        });
        return resList;
    }
    _global = (function () {
        return this || (0, eval)('this');
    }());
    // @ts-ignore
    if (typeof module !== 'undefined' && module.exports) {
        // @ts-ignore
        module.exports = CanvasTreeFlow;
    }
    else {
        // @ts-ignore
        if (typeof define === 'function' && define.cmd) {
            // @ts-ignore
            define(function () {
                return CanvasTreeFlow;
            });
        }
        else {
            !('CanvasTreeFlow' in _global) && (_global.CanvasTreeFlow = CanvasTreeFlow);
        }
    }
}());
