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

var WIDTH = 620
var HEIGHT = 480

class Arm {
    constructor(x, y, len, angle) {
        this.x = x
        this.y = y
        this.len = len
        this.angle = angle
        this.parent = null
    }

    getEndX() {
        var angle = this.angle
        var parent = this.parent
        while (parent) {
            angle += parent.angle
            parent = parent.parent
        }
        return this.x + Math.cos(angle) * this.len
    }

    getEndY() {
        var angle = this.angle
        var parent = this.parent
        while (parent) {
            angle += parent.angle
            parent = parent.parent
        }
        return this.y + Math.sin(angle) * this.len
    }

    render(context) {
        context.strokeStyle = "#FFFFFF"
        context.lineWidth = 5
        context.beginPath()
        context.moveTo(this.x, this.y)
        context.lineTo(this.getEndX(), this.getEndY())
        context.stroke()
    }
}

class FKSystem {
    constructor(x, y) {
        this.x = x
        this.y = y
        this.arms = []
        this.lastArm = null
    }

    addArm(len) {
        var arm = new Arm(0, 0, len, 0)
        this.arms.push(arm)
        if (this.lastArm) {
            arm.parent = this.lastArm
        }
        this.lastArm = arm
        this.update()
    }

    update() {
        for (var i = 0; i < this.arms.length; i++) {
            var arm = this.arms[i]
            if (arm.parent) {
                arm.x = arm.parent.getEndX()
                arm.y = arm.parent.getEndY()
            } else {
                arm.x = this.x
                arm.y = this.y
            }
        }
    }

    render(context) {
        for (var i = 0; i < this.arms.length; i++) {
            this.arms[i].render(context)
        }
    }

    rotateArm(index, angle) {
        this.arms[index].angle = angle
    }
}


var CanvasView = Marionette.ItemView.extend({
    template: require('../tmpl/canvas.hbs'),

    onShow: function () {
        this.canvas = this.$el.find('canvas')[0];
        this.context = this.canvas.getContext('2d');
        this.canvas.width = this.context.width = WIDTH;
        this.canvas.height = this.context.height = HEIGHT;

        this.t = 0
        this.fks = new FKSystem(WIDTH / 2, HEIGHT / 2)
        this.fks.addArm(100)
        this.fks.addArm(100)
        this.fks.addArm(100)
        //this.fks.addArm(150)
        //this.fks.addArm(100)

        this.animate = this.animate.bind(this)
        this.animate()
    },

    animate: function () {
        this.t += 1
        this.context.clearRect(0, 0, WIDTH, HEIGHT)

        this.fks.rotateArm(0, Math.sin(this.t * 0.05) * 1.2)
        this.fks.rotateArm(1, Math.sin(this.t * 0.15) * 0.2)
        this.fks.rotateArm(2, Math.sin(this.t * 0.02) * 3.2)

        this.fks.update()
        this.fks.render(this.context)

        requestAnimationFrame(this.animate)
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
