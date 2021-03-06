/**
 * Created by ld on 8/5/15.
 */

"use strict";

var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = window.$ = window.jQuery = $;
var Marionette = require('backbone.marionette');

var App = new Marionette.Application();

App.addRegions({
    nav: '#nav',
    content: '#content'
});

var EPSILON = 0.0000000000001

var COLORS = {
    white: "#FFFFFF",
    red: "#FF0000",
    green: "#00FF00",
    blue: "#0000FF",
}

class Link {
    constructor(x, y, len, angle) {
        this.x = x;
        this.y = y;
        this.len = len;
        this.angle = angle;
        this.parent = null
    }

    getEndX() {
        return this.x + Math.cos(this.angle) * this.len
    }

    getEndY() {
        return this.y + Math.sin(this.angle) * this.len
    }

    render(context) {
        context.strokeStyle = COLORS.white;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(this.x, this.y);
        context.lineTo(this.getEndX(), this.getEndY());
        context.stroke()
    }

    onAngleChange(cb) {
        this._onAngleChange = cb
    }

    pointAt(x, y) {
        var lastAngle = this.angle
        var dx = x - this.x;
        var dy = y - this.y;
        this.angle = Math.atan2(dy, dx)
        if (this._onAngleChange && Math.abs(this.angle - lastAngle) > EPSILON) {
            this._onAngleChange.call(this, this.angle)
        }
    }

    resetBase(x, y) {
        this.pointAt(x, y);
        this.x = x - Math.cos(this.angle) * this.len;
        this.y = y - Math.sin(this.angle) * this.len;
        if (this.parent) {
            this.parent.resetBase(this.x, this.y)
        }
    }
}

var CURSOR_STATES = {
    unlocked: 1,
    locked: 2
}

class Cursor {
    constructor(x, y) {
        this.x = x;
        this.y = y
        this.state = CURSOR_STATES.unlocked
    }

    onMouseMove(mousePos) {
        if (this.state !== CURSOR_STATES.locked) {
            this.x = mousePos.x
            this.y = mousePos.y
        }
    }

    onMouseUp() {
        this.state = this.state == CURSOR_STATES.locked ? CURSOR_STATES.unlocked : CURSOR_STATES.locked
    }

    render(context) {
        context.strokeStyle = this.state == CURSOR_STATES.locked ? COLORS.red : COLORS.white;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(this.x, this.y, 10, 0, 2 * Math.PI);
        context.stroke();
    }
}


class ArticulatedSystem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.links = [];
        this.lastLink = null
    }

    addLink(len) {
        var link = new Link(0, 0, len, 0);
        this.links.push(link);
        if (this.lastLink) {
            link.parent = this.lastLink
        }
        this.lastLink = link
    }

    render(context) {
        for (var i = 0; i < this.links.length; i++) {
            this.links[i].render(context)
        }
    }

    setLinkAngle(index, angle) {
        this.links[index].angle = angle
    }

    solveIK(x, y) {
        this.lastLink.resetBase(x, y);
        this.update()
    }

    update() {
        for (var i = 0; i < this.links.length; i++) {
            var arm = this.links[i];
            if (arm.parent) {
                arm.x = arm.parent.getEndX();
                arm.y = arm.parent.getEndY()
            } else {
                arm.x = this.x;
                arm.y = this.y
            }
        }
    }
}

var SliderView = Marionette.ItemView.extend({
    template: require('../tmpl/slider.hbs'),

    min: 0,
    max: 180,
    step: 1,

    templateHelpers: function () {
        return {
            min: this.getOption('min'),
            max: this.getOption('max'),
            step: this.getOption('step')
        };
    },

    events: {
        'change input': 'onUIChange',
        'mousedown input': 'startPolling',
        'mouseup input': 'stopPolling',
        'touchstart input': 'startPolling',
        'touchend input': 'stopPolling'
    },

    value: null,
    onUIChange: function () {
        this.value = parseFloat(this.$el.find('input').val());
        this.$el.find('small').text(this.value)
    },

    setValue: function (value) {
        this.value = parseFloat(value);
        this.$el.find('input').val(this.value);
        this.$el.find('small').text(this.value)
    },

    _pollingInterval: null,
    startPolling: function () {
        this._pollingInterval = setInterval(this.onUIChange.bind(this), 100)
    },

    stopPolling: function () {
        clearInterval(this._pollingInterval)
    },

    onShow: function () {
        this.onUIChange()
    },

    onDestroy: function () {
        this.stopPolling()
    }
});

var RowView = Marionette.LayoutView.extend({
    template: require('../tmpl/row.hbs'),

    childViews: [],

    initialize: function () {
        this.childViews = this.getOption('childViews')
        this.childViews.forEach(function (View, index) {
            this.addRegion('row' + index, '.row:nth-of-type(' + (index + 1) + ')');
        }.bind(this));
    },

    templateHelpers: function () {
        return {
            childViews: this.childViews
        };
    },

    onShow: function () {
        this.childViews.forEach(function (View, index) {
            this.getRegion('row' + index).show(View);
        }.bind(this));
    }
});

var CanvasView = Marionette.ItemView.extend({
    template: require('../tmpl/canvas.hbs'),

    events: {
        'mousemove': 'onMouseMove',
        'mouseup': 'onMouseUp'
    },

    width: null,
    height: null,

    updateWidthAndHeight: function () {
        var rect = this.$el.find('canvas')[0].getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height
    },

    onWindowResize: function () {
        this.updateWidthAndHeight();
        this.canvas.width = this.context.width = this.width;
        this.canvas.height = this.context.height = this.height;
        if (this.system) {
            this.system.x = this.width / 2;
            this.system.y = this.height / 2;
        }
    },

    initialize: function () {
        this.system = this.getOption('system')
        this.cursor = this.getOption('cursor')
        this.onWindowResize = this.onWindowResize.bind(this);
        this.animate = this.animate.bind(this)
    },

    getMousePos: function (evt) {
        var rect = this.$el.find('canvas')[0].getBoundingClientRect();
        var root = document.documentElement;

        // return relative mouse position
        var mouseX = evt.clientX - rect.left - root.scrollLeft;
        var mouseY = evt.clientY - rect.top - root.scrollTop;
        return {
            x: mouseX,
            y: mouseY
        };
    },

    mousePos: {
        x: 0,
        y: 0
    },

    onMouseMove: function (e) {
        this.mousePos = this.getMousePos(e);
        this.cursor.onMouseMove(this.mousePos)
    },

    onMouseUp: function (e) {
        this.cursor.onMouseUp()
    },

    onShow: function () {
        this.canvas = this.$el.find('canvas')[0];
        this.context = this.canvas.getContext('2d');
        this.context.fillStyle = "rgb(59,0,86)";

        this.onWindowResize();

        this.animate()
    },

    onDestroy: function () {
        window.removeEventListener('resize', this.onWindowResize, false);
    },

    animate: function () {
        this.context.clearRect(0, 0, this.width, this.height);

        this.cursor.render(this.context);

        this.system.render(this.context);
        this.system.solveIK(this.cursor.x, this.cursor.y)

        requestAnimationFrame(this.animate);
        //setTimeout(this.animate, 1000)
    }
});

var JointSliderView = SliderView.extend({
    min: -Math.PI,
    max: Math.PI,
    step: .001,

    initialize: function () {
        this.index = this.getOption('index')
        this.system = this.getOption('system')

        this.system.links[this.index].onAngleChange(function (value) {
            if (this.index == 0) {
                console.log(value)
            }
            this.setValue(value)
        }.bind(this))
    }
});

App.module("Kinematics", function (Mod, App, Backbone, Marionette, $, _) {

    var cursor = new Cursor(0, 0);
    var system = new ArticulatedSystem(this.width / 2, this.height / 2);

    system.addLink(100)
    system.addLink(100)
    system.addLink(100)

    var childViews = [new CanvasView({
        cursor: cursor,
        system: system
    })]

    for (var i = 0; i < system.links.length; i++) {
        childViews.push(new JointSliderView({
            system: system,
            index: i
        }))
    }

    Mod.addInitializer(function () {
        App.content.show(new RowView({
            childViews: childViews
        }));
    });
});

var NavView = Marionette.ItemView.extend({
    template: require('../tmpl/nav.hbs'),

    templateHelpers: function () {
        return {
            productName: 'kinematics experiments'
        };
    }
});

App.addInitializer(function () {
    App.nav.show(new NavView())
})

App.start();
