var mongoose = require('mongoose');
var async = require('async')
var util = require('util')

var getArgsWithOptions = function(__fill){
    var args = [],
        options = __fill.fill.options

    var opts = __fill.opts && __fill.opts.length
        ? __fill.opts
        : options

    if (opts && opts.length){

        // add lacking or remove excessive options
        if (options ){
            var diff = opts.length - options.length
            if (diff < 0){
                opts = opts.concat(options.slice(diff))
            } else if (diff > 0){
                opts = opts.slice(0, diff)
            }
        }
        args.push.apply(args, opts)
    }
    return args
}

var fillDoc = function(doc, __fill, cb){

    var args = getArgsWithOptions(__fill)

    if (__fill.fill.fill){
        args.unshift(doc)
        args.push(cb)
        __fill.fill.fill.apply(__fill.fill, args)
    } else if (__fill.fill.value) {
        var props = __fill.props,
            prop = props.length == 1 && props[0]

        var multipleProps = __fill.fill.props.length > 1

        //args.unshift(doc)
        args.push(function(err, val){
            // if val is not passed, just leave it
            if (arguments.length > 1 && val !== doc){
                if (prop){
                    doc[prop] = multipleProps ? val[prop] : val
                } else {
                    props.forEach(function(prop){
                        doc[prop] = val[prop]
                    })
                }
            }

            cb(err, doc)
        })
        __fill.fill.value.apply(doc, args)
    } else {
        cb(null, doc)
    }
}

var addFills = function(__fills, Model, props, opts){

    var added = false
    props.split(' ').forEach(function(prop){

        var fill = Model.__fill[prop]
        if (!fill){
            console.warn('mongoose-fill: fill for property', prop, 'not found')
            return
        }

        added = true
        fill.db = Model.db
        if (fill){
            // check if fill already added
            var __fill = __fills.filter(function(__f){return __f.fill == fill})[0]
            if (__fill){
                if (__fill.props.indexOf(prop) < 0){
                    __fill.props.push(prop)
                }
            } else {
                __fills.push({fill: fill, opts: opts, props: [prop]})
            }
        }
    })
    return added
}

var _exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.exec = function (op, cb) {
    var __fills = this.__fills || [];
    //console.log('query exec', this.options, 'this._conditions', this._conditions, this._fields)

    var query = this

    if (query.model.__fill && this._fields){
        Object.keys(this._fields).forEach(function(f){
            if (query._fields[f] == 1 && query.model.__fill[f]){
                addFills(__fills, query.model, f)
            }
        })
    }

    //TODO: add fill defaults
    //if (query.model.__fill){
    //    Object.keys(query.model.__fill).forEach(function(prop){
    //        if (!__fills[prop] && query.model.__fill[prop].default){
    //
    //        }
    //    })
    //}

    if (!__fills.length) {
        return _exec.apply(this, arguments);
    }

    var promise = new mongoose.Promise();

    if (typeof op === 'function') {
        cb = op;
        op = null;
    }

    if (cb) {
        promise.onResolve(cb);
    }

    var __query = {
        conditions: this._conditions,
        fields: this._fields,
        options: this.options
    }

    __fills.forEach(function(__fill){

        if (__fill.fill.query){
            var result = __fill.fill.query.apply(query, [__query, function(){

            }])
            if (result !== undefined){
                __fill.executed = true
            }
        }
    })

    _exec.call(this, op, function (err, docs) {
        //var resolve = promise.resolve.bind(promise);

        if (err || !docs) {
            promise.resolve(err, docs);
        } else {
            async.map(__fills, function(__fill, cb){
                if (__fill.executed){

                }
                var useMultiWithSingle = !util.isArray(docs) && !__fill.fill.value && __fill.fill.multi

                if (useMultiWithSingle){
                    docs = [docs]
                }


                // TODO: make this also if there is only multi methods when one doc
                if (util.isArray(docs)){
                    var args = getArgsWithOptions(__fill)

                    if (__fill.fill.multi){

                        var index = {},
                            ids = docs.map(function(doc){
                                var id = doc._id.toString()
                                index[id] = doc
                                return doc._id
                            }, {})
                        args.unshift(docs, ids)

                        var multipleProps = __fill.fill.props.length > 1

                        args.push(function(err, results){

                            if (results && results !== docs){

                                // convert object map to array in right order
                                if (!util.isArray(results)){
                                    results = ids.map(function(id){
                                        return results[id]
                                    })
                                }

                                results.forEach(function(r, i){
                                    if (!r){
                                        return
                                    }
                                    var doc = docs[i]

                                    var spreadProps = multipleProps

                                    // this is not the best idea, but we will allow this
                                    if (r._id && index[r._id.toString()]){
                                        spreadProps = true
                                        doc = index[r._id.toString()]
                                    }

                                    if (!doc){return}

                                    if (spreadProps){
                                        __fill.props.forEach(function(prop){
                                            doc[prop] = r[prop]
                                        })
                                    } else {
                                        var prop = __fill.fill.props[0]
                                        doc[prop] = r
                                    }
                                })
                            }
                            //console.log('mongoose fill multi done', docs)
                            if (useMultiWithSingle){
                                cb(err, docs[0])
                            } else {
                                cb(err, docs)
                            }
                        })

                        __fill.fill.multi.apply(__fill.fill, args)

                    } else {
                        async.map(docs, function(doc, cb){
                            fillDoc(doc, __fill, cb)
                        }, cb)
                    }
                } else {
                    fillDoc(docs, __fill, cb)
                }
            }, function(err){
                promise.resolve(err, docs);
            })
        }
    });

    return promise;
}

mongoose.Schema.prototype.fill = function(props, def) {

    this.statics.__fill = this.statics.__fill || {}

    def = def || {}

    if (typeof def == 'function') {
        def = {value: def}
    }

    var self = this

    props = props.split(' ')

    def.props = props

    props.forEach(function (prop) {
        self.statics.__fill[prop] = def

        self.virtual(prop).get(function () {
            return this['__' + prop]
        }).set(function (val) {
            this['__' + prop] = val
        })
    })

    var defFiller = [
        'value', 'multi',
        'query', 'debug', 'default', 'options']
        .reduce(function(defFiller, method){
            if (method == 'options'){
                defFiller[method] = function(){
                    def[method] = Array.prototype.slice.call(arguments);
                    return defFiller
                }
            } else {
                defFiller[method] = function(val){
                    def[method] = val
                    return defFiller
                }
            }

            return defFiller
        }, {})

    defFiller.get = defFiller.value

    return defFiller
}


mongoose.Query.prototype.fill = function() {

    var query = this;
    var Model = this.model;

    var args = Array.prototype.slice.call(arguments);
    var props = args.shift()
    var opts = args

    query.__fills = query.__fills || []

    addFills(query.__fills, Model, props, opts)

    return this
};

mongoose.Model.prototype.fill = function() {

    var doc = this;
    var Model = this.constructor;

    var args = Array.prototype.slice.call(arguments);
    var props = args.shift()
    var cb = typeof args[args.length - 1] == 'function' && args.pop()
    var opts = args

    var __fills = []

    addFills(__fills, Model, props, opts)

    async.map(__fills, function(__fill, cb){
        fillDoc(doc, __fill, cb)
    }, function(err){
        cb && cb(err, doc)
    })

    return this
};


mongoose.Model.prototype.filled = function(){

    var args = Array.prototype.slice.call(arguments);
    var cb = args[args.length - 1]
    if (typeof cb == 'function'){
        args[args.length - 1] = function(err, doc){
            cb(err, doc[prop])
        }
    }

    this.fill.apply(this, args)
}

module.exports = mongoose