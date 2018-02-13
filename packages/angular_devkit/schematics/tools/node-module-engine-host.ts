/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as core from '@angular-devkit/core/node';
import { dirname, join, resolve as resolvePath } from 'path';
import { RuleFactory } from '../src';
import {
  CollectionCannotBeResolvedException,
  CollectionMissingSchematicsMapException,
  SchematicMissingFieldsException,
} from '../tools';
import {
  FileSystemCollectionDesc,
  FileSystemSchematicDesc,
} from './description';
import { ExportStringRef } from './export-ref';
import { FileSystemEngineHostBase } from './file-system-engine-host-base';
import { readJsonFile } from './file-system-utility';


/**
 * A simple EngineHost that uses NodeModules to resolve collections.
 */
export class NodeModulesEngineHost extends FileSystemEngineHostBase {
  constructor() { super(); }

  protected _resolvePackageJson(name: string, basedir = process.cwd()) {
    return core.resolve(name, {
      basedir,
      checkLocal: true,
      checkGlobal: true,
      resolvePackageJson: true,
    });
  }

  protected _resolvePath(name: string, basedir = process.cwd()) {
    // Allow relative / absolute paths.
    if (name.startsWith('.') || name.startsWith('/')) {
      return resolvePath(basedir, name);
    } else {
      return core.resolve(name, {
        basedir,
        checkLocal: true,
        checkGlobal: true,
      });
    }
  }

  protected _resolveCollectionPath(name: string): string {
    let packageJsonPath = this._resolvePackageJson(name, process.cwd());
    // If it's a file, use it as is. Otherwise append package.json to it.
    if (!core.fs.isFile(packageJsonPath)) {
      packageJsonPath = join(packageJsonPath, 'package.json');
    }

    try {
      const pkgJsonSchematics = require(packageJsonPath)['schematics'];
      if (pkgJsonSchematics) {
        const resolvedPath = this._resolvePath(pkgJsonSchematics, dirname(packageJsonPath));
        readJsonFile(resolvedPath);

        return resolvedPath;
      }
    } catch (e) {
    }
    throw new CollectionCannotBeResolvedException(name);
  }

  protected _resolveReferenceString(refString: string, parentPath: string) {
    const ref = new ExportStringRef<RuleFactory<{}>>(refString, parentPath);
    if (!ref.ref) {
      return null;
    }

    return { ref: ref.ref, path: ref.module };
  }

  protected _transformCollectionDescription(
    name: string,
    desc: Partial<FileSystemCollectionDesc>,
  ): FileSystemCollectionDesc {
    if (!desc.schematics || typeof desc.schematics != 'object') {
      throw new CollectionMissingSchematicsMapException(name);
    }

    return {
      ...desc,
      name,
    } as FileSystemCollectionDesc;
  }

  protected _transformSchematicDescription(
    name: string,
    _collection: FileSystemCollectionDesc,
    desc: Partial<FileSystemSchematicDesc>,
  ): FileSystemSchematicDesc {
    if (!desc.factoryFn || !desc.path || !desc.description) {
      throw new SchematicMissingFieldsException(name);
    }

    return desc as FileSystemSchematicDesc;
  }
}