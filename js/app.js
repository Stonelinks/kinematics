/**
 * Created by ld on 8/5/15.
 */

"use strict";

var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = window.$ = window.jQuery = $;
var Marionette = require('backbone.marionette');
require('bootstrap');

class Link {
    constructor(x, y, len, angle) {
        this.x = x
        this.y = y
        this.len = len
        this.angle = angle
        this.parent = null
    }

    //getEndX() {
    //    var angle = this.angle
    //    var parent = this.parent
    //    while(parent) {
    //        angle += parent.angle
    //        parent = parent.parent
    //    }
    //    return this.x + Math.cos(angle) * this.len
    //}
    //getEndY() {
    //    var angle = this.angle
    //    var parent = this.parent
    //    while(parent) {
    //        angle += parent.angle
    //        parent = parent.parent
    //    }
    //    return this.y + Math.sin(angle) * this.len
    //}

    getEndX() {
        return this.x + Math.cos(this.angle) * this.len
    }

    getEndY() {
        return this.y + Math.sin(this.angle) * this.len
    }

    render(context) {
        context.strokeStyle = "#FFFFFF"
        context.lineWidth = 5
        context.beginPath()
        context.moveTo(this.x, this.y)
        context.lineTo(this.getEndX(), this.getEndY())
        context.stroke()
    }

    pointAt(x, y) {
        var dx = x - this.x
        var dy = y - this.y
        this.angle = Math.atan2(dy, dx)
    }

    resetBase(x, y) {
        this.pointAt(x, y)
        this.x = x - Math.cos(this.angle) * this.len
        this.y = y - Math.sin(this.angle) * this.len
        if (this.parent) {
            this.parent.resetBase(this.x, this.y)
        }
    }
}

class ArticulatedSystem {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.links = []
        this.lastLink = null
    }

    addLink(len) {
        var link = new Link(0, 0, len, 0)
        this.links.push(link)
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
        this.lastLink.resetBase(x, y)
        this.update()
    }

    update() {
        for (var i = 0; i < this.links.length; i++) {
            var arm = this.links[i]
            if (arm.parent) {
                arm.x = arm.parent.getEndX()
                arm.y = arm.parent.getEndY()
            } else {
                arm.x = this.x
                arm.y = this.y
            }
        }
    }
}

var CanvasView = Marionette.ItemView.extend({
    template: require('../tmpl/canvas.hbs'),

    events: {
        'mousemove': 'onMouseMove'
    },

    width: 640,
    height: 480,

    updateWidthAndHeight: function () {
        var rect = this.$el.find('canvas')[0].getBoundingClientRect()
        this.width = rect.width
        this.height = rect.height
    },

    onWindowResize: function () {
        this.updateWidthAndHeight()
        this.canvas.width = this.context.width = this.width;
        this.canvas.height = this.context.height = this.height;
    },

    initialize: function () {
        this.onWindowResize = this.onWindowResize.bind(this)
        this.animate = this.animate.bind(this)
    },

    getMousePos: function (evt) {
        var rect = this.$el.find('canvas')[0].getBoundingClientRect()
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
        this.mousePos = this.getMousePos(e)
    },

    onShow: function () {
        this.canvas = this.$el.find('canvas')[0];
        this.context = this.canvas.getContext('2d');
        this.context.fillStyle = "rgb(200,0,0)";

        this.onWindowResize()

        this.t = 0

        this.system = new ArticulatedSystem(0, 0)
        for (var i = 0; i < 1000; i++) {
            this.system.addLink(5)
        }

        this.animate()
    },

    onDestroy: function () {
        window.removeEventListener('resize', this.onWindowResize, false);
    },

    animate: function () {
        this.t += 1;
        this.context.clearRect(0, 0, this.width, this.height)
        this.context.fillRect(0, 0, this.width, this.height)

        this.system.render(this.context)

        this.system.solveIK(this.mousePos.x, this.mousePos.y)

        // cursor
        this.context.beginPath();
        this.context.arc(this.mousePos.x, this.mousePos.y, 15, 0, 2 * Math.PI);
        this.context.stroke();

        requestAnimationFrame(this.animate)
        //setTimeout(this.animate, 1000)
    }
});

var Pages = {
    home: function (viewPort) {
        viewPort.show(new CanvasView());
    }
};

var NavView = Marionette.ItemView.extend({
    template: require('../tmpl/nav.hbs'),

    templateHelpers: function () {
        return {
            productName: 'kinematics'
        };
    },

    onRender: function () {
        var activeClass = 'btn-primary';
        var inactiveClass = 'btn-default';
        var navButtons = '.navbar-nav a';

        this.$el.find(navButtons).removeClass(activeClass);
        var activeButton;
        if (!window.location.hash.length) {
            activeButton = navButtons + '[href="#home"]';
        } else {
            activeButton = navButtons + '[href="' + window.location.hash + '"]';
        }
        this.$el.find(activeButton).addClass(activeClass);
        this.$el.find(navButtons).not(activeButton).addClass(inactiveClass);
    }
});

var app = new Marionette.Application();
window.app = app;

app.addRegions({
    nav: '#nav',
    content: '#content'
});

// set up nav
var nav = new NavView();
app.addInitializer(function () {
    app.getRegion('nav').show(nav);
});

// main pages
var showView = function (viewWrapperFunc) {
    return function () {
        var viewPort = app.getRegion('content');
        viewWrapperFunc(viewPort);
    }
};

var pages = {
    home: showView(Pages.home)
};
pages['*catchall'] = pages.home;

var Router = Marionette.AppRouter.extend({
    routes: pages
});

// start the router
app.addInitializer(function (opts) {
    this.router = new Router();
    this.router.on('route', function () {
        nav.render();
    });
    Backbone.history.start({
        // pushState: true
    });
});

app.start();
