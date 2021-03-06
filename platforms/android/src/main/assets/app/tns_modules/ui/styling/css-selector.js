var observable = require("ui/core/dependency-observable");
var trace = require("trace");
var styleProperty = require("ui/styling/style-property");
var types = require("utils/types");
var utils = require("utils/utils");
var ID_SPECIFICITY = 1000000;
var ATTR_SPECIFITY = 10000;
var CLASS_SPECIFICITY = 100;
var TYPE_SPECIFICITY = 1;
var CssSelector = (function () {
    function CssSelector(expression, declarations) {
        if (expression) {
            var leftSquareBracketIndex = expression.indexOf(LSBRACKET);
            if (leftSquareBracketIndex > 0) {
                var paramsRegex = /\[\s*(.*)\s*\]/;
                var attrParams = paramsRegex.exec(expression);
                if (attrParams && attrParams.length > 1) {
                    this._attrExpression = attrParams[1].trim();
                }
                this._expression = expression.substr(0, leftSquareBracketIndex);
            }
            else {
                this._expression = expression;
            }
        }
        this._declarations = declarations;
    }
    Object.defineProperty(CssSelector.prototype, "expression", {
        get: function () {
            return this._expression;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CssSelector.prototype, "attrExpression", {
        get: function () {
            return this._attrExpression;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CssSelector.prototype, "declarations", {
        get: function () {
            return this._declarations;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CssSelector.prototype, "specificity", {
        get: function () {
            throw "Specificity property is abstract";
        },
        enumerable: true,
        configurable: true
    });
    CssSelector.prototype.matches = function (view) {
        return false;
    };
    CssSelector.prototype.apply = function (view) {
        this.eachSetter(function (property, value) {
            try {
                view.style._setValue(property, value, observable.ValueSource.Css);
            }
            catch (ex) {
                trace.write("Error setting property: " + property.name + " view: " + view + " value: " + value + " " + ex, trace.categories.Style, trace.messageType.error);
            }
        });
    };
    CssSelector.prototype.eachSetter = function (callback) {
        for (var i = 0; i < this._declarations.length; i++) {
            var declaration = this._declarations[i];
            var name_1 = declaration.property;
            var resolvedValue = declaration.value;
            var property = styleProperty.getPropertyByCssName(name_1);
            if (property) {
                callback(property, resolvedValue);
            }
            else {
                var pairs = styleProperty.getShorthandPairs(name_1, resolvedValue);
                if (pairs) {
                    for (var j = 0; j < pairs.length; j++) {
                        var pair = pairs[j];
                        callback(pair.property, pair.value);
                    }
                }
            }
        }
    };
    return CssSelector;
})();
exports.CssSelector = CssSelector;
var CssTypeSelector = (function (_super) {
    __extends(CssTypeSelector, _super);
    function CssTypeSelector() {
        _super.apply(this, arguments);
    }
    Object.defineProperty(CssTypeSelector.prototype, "specificity", {
        get: function () {
            return TYPE_SPECIFICITY;
        },
        enumerable: true,
        configurable: true
    });
    CssTypeSelector.prototype.matches = function (view) {
        var result = matchesType(this.expression, view);
        if (result && this.attrExpression) {
            return matchesAttr(this.attrExpression, view);
        }
        return result;
    };
    return CssTypeSelector;
})(CssSelector);
function matchesType(expression, view) {
    var exprArr = expression.split(".");
    var exprTypeName = exprArr[0];
    var exprClassName = exprArr[1];
    var typeCheck = exprTypeName.toLowerCase() === view.typeName.toLowerCase() ||
        exprTypeName.toLowerCase() === view.typeName.split(/(?=[A-Z])/).join("-").toLowerCase();
    if (typeCheck) {
        if (exprClassName) {
            return view._cssClasses.some(function (cssClass, i, arr) { return cssClass === exprClassName; });
        }
        else {
            return typeCheck;
        }
    }
    else {
        return false;
    }
}
var CssIdSelector = (function (_super) {
    __extends(CssIdSelector, _super);
    function CssIdSelector() {
        _super.apply(this, arguments);
    }
    Object.defineProperty(CssIdSelector.prototype, "specificity", {
        get: function () {
            return ID_SPECIFICITY;
        },
        enumerable: true,
        configurable: true
    });
    CssIdSelector.prototype.matches = function (view) {
        var result = this.expression === view.id;
        if (result && this.attrExpression) {
            return matchesAttr(this.attrExpression, view);
        }
        return result;
    };
    return CssIdSelector;
})(CssSelector);
var CssClassSelector = (function (_super) {
    __extends(CssClassSelector, _super);
    function CssClassSelector() {
        _super.apply(this, arguments);
    }
    Object.defineProperty(CssClassSelector.prototype, "specificity", {
        get: function () {
            return CLASS_SPECIFICITY;
        },
        enumerable: true,
        configurable: true
    });
    CssClassSelector.prototype.matches = function (view) {
        var expectedClass = this.expression;
        var result = view._cssClasses.some(function (cssClass, i, arr) { return cssClass === expectedClass; });
        if (result && this.attrExpression) {
            return matchesAttr(this.attrExpression, view);
        }
        return result;
    };
    return CssClassSelector;
})(CssSelector);
var CssCompositeSelector = (function (_super) {
    __extends(CssCompositeSelector, _super);
    function CssCompositeSelector(expr, declarations) {
        _super.call(this, expr, declarations);
        var expressions = this.splitExpression(expr);
        var onlyParent = false;
        this.parentCssSelectors = [];
        for (var i = expressions.length - 1; i >= 0; i--) {
            if (expressions[i].trim() === GTHAN) {
                onlyParent = true;
                continue;
            }
            this.parentCssSelectors.push({ selector: createSelector(expressions[i].trim(), null), onlyDirectParent: onlyParent });
            onlyParent = false;
        }
    }
    Object.defineProperty(CssCompositeSelector.prototype, "specificity", {
        get: function () {
            var result = 0;
            for (var i = 0; i < this.parentCssSelectors.length; i++) {
                result += this.parentCssSelectors[i].selector.specificity;
            }
            return result;
        },
        enumerable: true,
        configurable: true
    });
    CssCompositeSelector.prototype.splitExpression = function (expression) {
        var result = [];
        var tempArr = [];
        var validSpace = true;
        for (var i = 0; i < expression.length; i++) {
            if (expression[i] === LSBRACKET) {
                validSpace = false;
            }
            if (expression[i] === RSBRACKET) {
                validSpace = true;
            }
            if ((expression[i] === SPACE && validSpace) || (expression[i] === GTHAN)) {
                if (tempArr.length > 0) {
                    result.push(tempArr.join(""));
                    tempArr = [];
                }
                if (expression[i] === GTHAN) {
                    result.push(GTHAN);
                }
                continue;
            }
            tempArr.push(expression[i]);
        }
        if (tempArr.length > 0) {
            result.push(tempArr.join(""));
        }
        return result;
    };
    CssCompositeSelector.prototype.matches = function (view) {
        var result = this.parentCssSelectors[0].selector.matches(view);
        if (!result) {
            return result;
        }
        var tempView = view.parent;
        for (var i = 1; i < this.parentCssSelectors.length; i++) {
            var parentCounter = 0;
            while (tempView && parentCounter === 0) {
                result = this.parentCssSelectors[i].selector.matches(tempView);
                if (result) {
                    tempView = tempView.parent;
                    break;
                }
                if (this.parentCssSelectors[i].onlyDirectParent) {
                    parentCounter++;
                }
                tempView = tempView.parent;
            }
            if (!result) {
                break;
                return result;
            }
        }
        return result;
    };
    return CssCompositeSelector;
})(CssSelector);
var CssAttrSelector = (function (_super) {
    __extends(CssAttrSelector, _super);
    function CssAttrSelector() {
        _super.apply(this, arguments);
    }
    Object.defineProperty(CssAttrSelector.prototype, "specificity", {
        get: function () {
            return ATTR_SPECIFITY;
        },
        enumerable: true,
        configurable: true
    });
    CssAttrSelector.prototype.matches = function (view) {
        return matchesAttr(this.attrExpression, view);
    };
    return CssAttrSelector;
})(CssSelector);
function matchesAttr(attrExpression, view) {
    var equalSignIndex = attrExpression.indexOf(EQUAL);
    if (equalSignIndex > 0) {
        var nameValueRegex = /(.*[^~|\^\$\*])[~|\^\$\*]?=(.*)/;
        var nameValueRegexRes = nameValueRegex.exec(attrExpression);
        var attrName;
        var attrValue;
        if (nameValueRegexRes && nameValueRegexRes.length > 2) {
            attrName = nameValueRegexRes[1].trim();
            attrValue = nameValueRegexRes[2].trim().replace(/^(["'])*(.*)\1$/, '$2');
        }
        var escapedAttrValue = utils.escapeRegexSymbols(attrValue);
        var attrCheckRegex;
        switch (attrExpression.charAt(equalSignIndex - 1)) {
            case "~":
                attrCheckRegex = new RegExp("(^|[^a-zA-Z-])" + escapedAttrValue + "([^a-zA-Z-]|$)");
                break;
            case "|":
                attrCheckRegex = new RegExp("^" + escapedAttrValue + "\\b");
                break;
            case "^":
                attrCheckRegex = new RegExp("^" + escapedAttrValue);
                break;
            case "$":
                attrCheckRegex = new RegExp(escapedAttrValue + "$");
                break;
            case "*":
                attrCheckRegex = new RegExp(escapedAttrValue);
                break;
            default:
                attrCheckRegex = new RegExp("^" + escapedAttrValue + "$");
                break;
        }
        return !types.isNullOrUndefined(view[attrName]) && attrCheckRegex.test(view[attrName] + "");
    }
    else {
        return !types.isNullOrUndefined(view[attrExpression]);
    }
    return false;
}
var CssVisualStateSelector = (function (_super) {
    __extends(CssVisualStateSelector, _super);
    function CssVisualStateSelector(expression, declarations) {
        _super.call(this, expression, declarations);
        var args = expression.split(COLON);
        this._key = args[0];
        this._state = args[1];
        if (this._key.charAt(0) === HASH) {
            this._match = this._key.substring(1);
            this._isById = true;
        }
        else if (this._key.charAt(0) === DOT) {
            this._match = this._key.substring(1);
            this._isByClass = true;
        }
        else if (this._key.charAt(0) === LSBRACKET) {
            this._match = this._key;
            this._isByAttr = true;
        }
        else if (this._key.length > 0) {
            this._match = this._key;
            this._isByType = true;
        }
    }
    Object.defineProperty(CssVisualStateSelector.prototype, "specificity", {
        get: function () {
            return (this._isById ? ID_SPECIFICITY : 0) +
                (this._isByAttr ? ATTR_SPECIFITY : 0) +
                (this._isByClass ? CLASS_SPECIFICITY : 0) +
                (this._isByType ? TYPE_SPECIFICITY : 0);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CssVisualStateSelector.prototype, "key", {
        get: function () {
            return this._key;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CssVisualStateSelector.prototype, "state", {
        get: function () {
            return this._state;
        },
        enumerable: true,
        configurable: true
    });
    CssVisualStateSelector.prototype.matches = function (view) {
        var matches = true;
        if (this._isById) {
            matches = this._match === view.id;
        }
        if (this._isByClass) {
            var expectedClass = this._match;
            matches = view._cssClasses.some(function (cssClass, i, arr) { return cssClass === expectedClass; });
        }
        if (this._isByType) {
            matches = matchesType(this._match, view);
        }
        if (this._isByAttr) {
            matches = matchesAttr(this._key, view);
        }
        return matches;
    };
    return CssVisualStateSelector;
})(CssSelector);
exports.CssVisualStateSelector = CssVisualStateSelector;
var HASH = "#";
var DOT = ".";
var COLON = ":";
var SPACE = " ";
var GTHAN = ">";
var LSBRACKET = "[";
var RSBRACKET = "]";
var EQUAL = "=";
function createSelector(expression, declarations) {
    var goodExpr = expression.replace(/>/g, " > ").replace(/\s\s+/g, " ");
    var spaceIndex = goodExpr.indexOf(SPACE);
    if (spaceIndex >= 0) {
        return new CssCompositeSelector(goodExpr, declarations);
    }
    var leftSquareBracketIndex = goodExpr.indexOf(LSBRACKET);
    if (leftSquareBracketIndex === 0) {
        return new CssAttrSelector(goodExpr, declarations);
    }
    var colonIndex = goodExpr.indexOf(COLON);
    if (colonIndex >= 0) {
        return new CssVisualStateSelector(goodExpr, declarations);
    }
    if (goodExpr.charAt(0) === HASH) {
        return new CssIdSelector(goodExpr.substring(1), declarations);
    }
    if (goodExpr.charAt(0) === DOT) {
        return new CssClassSelector(goodExpr.substring(1), declarations);
    }
    return new CssTypeSelector(goodExpr, declarations);
}
exports.createSelector = createSelector;
var InlineStyleSelector = (function (_super) {
    __extends(InlineStyleSelector, _super);
    function InlineStyleSelector(declarations) {
        _super.call(this, undefined, declarations);
    }
    InlineStyleSelector.prototype.apply = function (view) {
        this.eachSetter(function (property, value) {
            view.style._setValue(property, value, observable.ValueSource.Local);
        });
    };
    return InlineStyleSelector;
})(CssSelector);
function applyInlineSyle(view, declarations) {
    var localStyleSelector = new InlineStyleSelector(declarations);
    localStyleSelector.apply(view);
}
exports.applyInlineSyle = applyInlineSyle;
