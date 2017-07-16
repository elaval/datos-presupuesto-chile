const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
var path = require('path');

// pull in the project Typescript config
const tsProject = ts.createProject('tsconfig.json');
//task to be run when the watcher detects changes
gulp.task('scripts', () => {
    const tsResult = tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject());


    return tsResult.js
        .pipe(sourcemaps.write({
        // Return relative source map root directories per file.
        sourceRoot: function (file) {
            var sourceFile = path.join(file.cwd, file.sourceMap.file);
            return path.relative(path.dirname(sourceFile), file.cwd);
        }
        }))
        .pipe(gulp.dest('.'));    
    return tsResult.js.pipe(gulp.dest(''));
});
//set up a watcher to watch over changes
gulp.task('watch', ['scripts'], () => {
    gulp.watch('**/*.ts', ['scripts']);
});

gulp.task('default', ['watch']);


