"""Validation des sauvegardes et transferts (même schéma que validPayload JS)."""
import datetime
import json
import math
import re

SAFE = 9007199254740991
ALLOWED = {'v','sv','ra','n','x','sc','sl','k','bb','cr','p','cf','pn','av','avt'}

def number(x, maximum=SAFE, integer=True):
    return (type(x) in (int, float) and 0 <= x <= maximum and math.isfinite(x)
            and (not integer or int(x) == x))

def mapping(obj, key, value):
    return type(obj) is dict and all(key(k) and value(v) for k,v in obj.items())

def code(k):
    return isinstance(k,str) and re.fullmatch(r'(?:[1-9]|[1-5][0-9]|6[0-9])',k) is not None

def valid_payload(o):
    if type(o) is not dict or o.get('v') != 1 or type(o.get('v')) is not int or not set(o) <= ALLOWED:
        return False
    if 'sv' in o and (type(o['sv']) is not int or o['sv'] != 2): return False
    if 'n' in o and (not isinstance(o['n'],str) or len(o['n'].encode('utf-16-le',errors='surrogatepass'))//2 > 100): return False
    if any(k in o and not number(o[k]) for k in ('x','sc','bb','ra','avt')): return False
    if any(k in o and (type(o[k]) is not int or o[k] not in (0,1)) for k in ('k','pn')): return False
    if o.get('sl') is not None:
        try:
            if not isinstance(o['sl'],str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',o['sl']): return False
            datetime.date.fromisoformat(o['sl'])
        except ValueError: return False
    def record(r):
        return (type(r) is list and len(r) in (2,3) and number(r[0],5)
                and number(r[1],1e7,False) and (len(r)==2 or number(r[2])))
    if not mapping(o.get('p'),code,record): return False
    if 'cr' in o and not mapping(o['cr'],lambda k: re.fullmatch(r'u[1-8]',k),lambda v:number(v,5)): return False
    if 'cf' in o and not mapping(o['cf'],code,lambda m:mapping(m,code,number)): return False
    a=o.get('av')
    if a is not None:
        if type(a) is not dict or set(a) != {'k','v'}: return False
        if a['k']=='m':
            if a['v'] not in ('fennec','chameau','cigogne','palmier'): return False
        elif (a['k']!='p' or not isinstance(a['v'],str) or len(a['v'])>61440
              or not re.fullmatch(r'data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}',a['v'])): return False
    return True

def encode_payload(value, max_body):
    if not valid_payload(value): return None
    try:
        encoded=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
        return encoded if len(encoded.encode('utf-8')) <= max_body else None
    except (UnicodeError, ValueError):
        return None
