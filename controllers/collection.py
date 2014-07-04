def get_schemas():
    import os
    import json
    filename = os.path.join(request.folder,'modules','all.json')
    schemas = json.load(open(filename))
    return schemas
 
def define_from_schema(db, tablename, schemas=None):
    from gluon.utils import web2py_uuid
    schemas = schemas or get_schemas()
    PROPERTIES = schemas['properties'] # label, comment, ranges
    TABLENAMES = schemas['types'].keys()    
    datatypes = {'DataType':('string',None), 
                 'Text':('string',None), 
                 'Float':('double',None), 
                 'Number':('double',None), 
                 'DateTime':('datetime',None), 
                 'URL':('string',None), 
                 'Boolean':('boolean',None), 
                 'Time':('time',None), 
                 'Date':('date',None), 
                 'Integer':('integer',None)}
    if tablename in schemas['types']:
        #print tablename, schemas['types'][tablename]['properties']
        properties = schemas['types'][tablename]['properties']
        fields = [Field('uuid','string',default=lambda:web2py_uuid(),writable=False)]
        for property in properties:
            info = PROPERTIES[property]
            label = info['label']
            comment = info['comment']
            ranges = info['ranges']
            if len(ranges)==1 and ranges[0] in datatypes:
                ftype = datatypes[ranges[0]][0]
            else:
                ftype = 'list:string'
            fields.append(Field('f'+property,ftype,label=label))
        table = db.define_table('t'+tablename,*fields)
        if db(table).isempty():
            from gluon.contrib.populate import populate
            populate(table,120)
        return table
    return None

def api1(): 
    from gluon.contrib.hypermedia import Collection
    tablename = request.args(0)
    if not tablename:
        schemas = get_schemas()
        rules = {}
        for name in schemas['types'].keys():
            rules['t'+name] = {'GET':{}}
    else:
        define_from_schema(db,tablename[1:])
        print db.tables
        fields = db[tablename].fields
        rules = {tablename: {'GET':{},'POST':{},'PUT':{},'DELETE':{}}}
    return Collection(db).process(request,response,rules)

def api2():
    from gluon.contrib.hypermedia import Collection
    rules = {
        'thing': {'GET':{},'POST':{},'PUT':{},'DELETE':{}},
        'attr': {'GET':{},'POST':{},'PUT':{},'DELETE':{}},
        }
    return Collection(db).process(request,response,rules)

@cache.action()
def download():
    return response.download(request, db)

def index():
    response.delimiters = ['<%','%>']
    return dict()
