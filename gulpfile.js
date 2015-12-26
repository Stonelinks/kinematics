var gulp = require('gulp'),
    package = require('./package.json'),
    tap = require('gulp-tap'),
    webserver = require('gulp-webserver'),
    rename = require('gulp-rename'),
    clean = require('gulp-clean'),
    browserify = require('browserify'),
    handlebars = require('handlebars'),
    sourcemaps = require('gulp-sourcemaps'),
    less = require('gulp-less'),
    buffer = require('vinyl-buffer'),
    source = require('vinyl-source-stream');

var path = {
    tmpl: './tmpl/**/*.hbs',
    style: './style/**/*.less',
    js: './js/**/*.js',
    images: './images/**/*.*',
    fonts: './node_modules/bootstrap/fonts/**/*.*',
    index: './*.hbs',
    build: './build/'
};

function onError(err) {
    console.log(err);
    this.emit('end');
}

gulp.task('js', function () {
    var bundler = browserify({
        entries: ['./js/app.js'],
        debug: true
    });

    var bundle = function () {
        return bundler
            .bundle()
            .on('error', onError)
            .pipe(source(package.name + '.' + package.version + '.min.js'))
            .pipe(buffer())
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest(path.build + 'js'))
    };
    return bundle();
});

gulp.task('images', function () {
    return gulp.src(path.images)
        .pipe(gulp.dest(path.build + 'images'));
});
gulp.task('fonts', function () {
    return gulp.src(path.fonts)
        .pipe(gulp.dest(path.build + 'fonts'));
});

gulp.task('style', function () {
    return gulp.src(path.style)
        .pipe(sourcemaps.init())
        .pipe(less({
            paths: ['./node_modules/bootstrap/less']
        }))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(path.build + 'style'));
});

gulp.task('index', function () {
    return gulp.src(path.index)
        .pipe(tap(function (file, t) {
            var template = handlebars.compile(file.contents.toString());
            var html = template(package);
            file.contents = new Buffer(html, 'utf-8');
        }))
        .pipe(rename(function (path) {
            path.extname = '.html';
        }))
        .pipe(gulp.dest(path.build));
});

gulp.task('webserver', function () {
    return gulp.src(path.build)
        .pipe(webserver({
            host: 'localhost',
            port: '8009',
            livereload: true,
            //directoryListing: true,
            open: true
        }));
});

gulp.task('clean', function () {
    return gulp.src(path.build)
        .pipe(clean());
});

gulp.task('build', ['js', 'style', 'index', 'fonts', 'images']);

gulp.task('watch', ['build'], function () {
    gulp.watch(path.js, ['js']);
    gulp.watch(path.style, ['style']);
    gulp.watch(path.tmpl, ['js']);
    gulp.watch(path.images, ['images']);
    gulp.watch(path.fonts, ['fonts']);
    gulp.watch(path.index, ['index']);
});

gulp.task('develop', ['watch', 'webserver']);

gulp.task('default', ['build']);
