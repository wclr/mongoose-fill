# mongoose-fill

mongoose-fill is mongoose.js add-on that adds simple api for virtual async fields.

## api use cases

basic use case fills single filed

  ```javascript
  // import of 'mongoose-fill' patches mongoose and returns mongoose object, so you can do:
  var mongoose = require('mongoose-fill')
      ...
  
  myParentSchema.fill('children', function(callback){
    this.db.model('Child')
        .find({parent: this.id})
        .select('name age')
        .order('-age')
        .exec(callback)
  })
  ...
  Parent.findById(1).fill('children').exec().then(function(parent){
    //parent.children <- will be array of children with fields name and age ordered by age
  })
  ```
  
  filling property using single query for multiple objects
  ```javascript
 
  myParentSchema.fill('childrenCount').value(function(callback){
    // `this` is found instance
    this.db.model('Child')
        .count({parent: this.id})
        .exec(callback)
  // multi is used for queries with multiple fields
  }).multi(function(docs, ids, callback){
    // `this` is just object 
    // query childrenCount for all found parents with single db query
    this.db.model('Child')
        .aggregate([{
            $group: {
                _id: '$parent',
                childrenCount: {$sum: 1}
            }},
            {$match: {'_id': {$in: ids}}}
        ], callback)
  })
  ...
 
  Parent.find({}).select('name childrenCount).exec().then(function(parents){
    //parent.childrenCount <- will contain count of children
  })
  ```
  
  using fill options with default values
  ```
    myParentSchema.fill('children', select, order, function(callback){
    this.db.model('Child')
        .find({parent: this.id})
        .select(select)
        .order(order)
        .exec(callback)
  }).options('', '-age')
  ...
  
  // fill children with only `name age` properties ordered by `age`
  Parent.findById(1).fill('children', 'name age', 'age').exec().then(function(parent){
    //parent.children <- will be array of children with fields name and age ordered by age
  })
  ```
  
  ## how does it work
 
  1) adds fill method to mongoose schema object 
  2) adds `fill` and `filled` prototype methods to mongoose model 
  3) patches mongoose query exec method to allow extend query api with `fill` method
  4) virtual props are implemented by using `__propName` virtual getter (check the code)
  
 

### Version
1.0.0

### Installation

npm install mongoose-fill