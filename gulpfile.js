var gulp    = require('gulp'),
    fs      = require('fs'),
    rename = require('gulp-rename'),
    concat  = require('gulp-concat'),
    uglify  = require('gulp-uglify'),
    less    = require('gulp-less'),
    browserify = require('browserify'),
    vueify = require('vueify'),
    build   = require('./vendor/semantic/tasks/build');

gulp.task('build:semantic', build);


/************
 * SCRIPTS  *
 ***********/
gulp.task('scripts:vendor', function() {
    return gulp.src('vendor/semantic/dist/semantic.min.js')
        .pipe(concat('vendor.js'))
        .pipe(gulp.dest('dist/public/js'));
});

gulp.task('scripts', function () {
    browserify('scripts/peergos.js')
        .transform('stringify', {
            appliesTo: { includeExtensions: ['.html'] },
        })
        .transform('vueify')
        .bundle()
        .pipe(fs.createWriteStream('dist/public/js/peergos.js'));
});


/************
 *  STYLES  *
 ***********/

gulp.task('less:vendor', function () {
    return gulp.src('vendor/semantic/dist/semantic.min.css')
        .pipe(concat('vendor.css'))
        .pipe(less())
        .pipe(gulp.dest('dist/public/css'));
});

gulp.task('less', function () {
    return gulp.src('styles/peergos.less')
        .pipe(less())
        .pipe(gulp.dest('dist/public/css'));
});

gulp.task('html', function () {
    return gulp.src('index.html')
        .pipe(gulp.dest('dist/'));
});

gulp.task('assets', function () {
    return gulp.src('assets/*/*')
        .pipe(gulp.dest('dist/public/'));
});


gulp.task('build:vendor', ['build:semantic', 'less:vendor', 'scripts:vendor']);

// Default Task
gulp.task('default', ['less', 'scripts', 'html', 'assets']);

