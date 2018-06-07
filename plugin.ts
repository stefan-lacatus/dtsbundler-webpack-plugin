class DtsBundlerPlugin {
  out: string;
  moduleName: string;
  excludedReferences: any[];
  excludePattern?: RegExp;

  constructor(options: any = {}) {
    this.out = options.out || './build/';
    this.excludedReferences = options.excludedReferences ? options.excludedReferences : undefined;
    this.moduleName = options.moduleName || 'Lib';
    this.excludePattern = options.excludePattern || undefined;
  }

  apply(compiler) {
    //when the compiler is ready to emit files
    compiler.hooks.emit.tapAsync('DtsBundlerPlugin', (compilation, callback) => {
      //collect all generated declaration files
      //and remove them from the assets that will be emited
      var declarationFiles = {};
      for (var filename in compilation.assets) {
        if (filename.indexOf('.d.ts') !== -1) {
          if(!(this.excludePattern && filename.match(this.excludePattern))) {
            declarationFiles[filename] = compilation.assets[filename];
          }
          delete compilation.assets[filename];
        }
      }

      //combine them into one declaration file
      var combinedDeclaration = this.generateCombinedDeclaration(declarationFiles);

      //and insert that back into the assets
      compilation.assets[this.out] = {
        source: function () {
          return combinedDeclaration;
        },
        size: function () {
          return combinedDeclaration.length;
        }
      };

      //webpack may continue now
      callback();
    });
  }

  private generateCombinedDeclaration(declarationFiles: Object): string {
    var declarations = '';

    for (var fileName in declarationFiles) {
      var declarationFile = declarationFiles[fileName];
      var data = declarationFile.source();

      var lines = data.split('\n');
      var i = lines.length;


      while (i--) {
        var line = lines[i];

        //exclude empty lines
        var excludeLine = line == '';

        //exclude export statements
        excludeLine = excludeLine || (/export\s+({)|(default)/.test(line) && fileName !== 'main.d.ts');

        // leave a line with inline export but remove export keyword
        if (!excludeLine && fileName !== 'main.d.ts') {
          lines[i] = lines[i].replace(/export\s/, '');
          lines[i] = lines[i].replace(/declare\s/, '');
          line = lines[i];
        }

        //exclude import statements
        excludeLine = excludeLine || line.indexOf('import') !== -1;

        //if defined, check for excluded references
        if (!excludeLine && this.excludedReferences && line.indexOf('<reference') !== -1) {
          excludeLine = this.excludedReferences.some(reference => line.indexOf(reference) !== -1);
        }
        if (excludeLine) {
          lines.splice(i, 1);
        }
        else {
          // Adding internal module indentation
          lines[i] = '  ' + lines[i];
        }
      }
      declarations += lines.join('\n') + '\n\n';
    }

    return `declare module ${this.moduleName}\n{\n${declarations}}\nmodule.exports = ${this.moduleName};`;;
  }

}

export = DtsBundlerPlugin;
