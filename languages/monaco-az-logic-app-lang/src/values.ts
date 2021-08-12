import {
  createFunValDesc,
  createOverloadedFunValDesc,
  createPkgValDesc,
  createRefValDesc,
  DescriptionType,
  DescriptorCollection,
  DescriptorCollectionItem,
  IdentifierInBracketNotationReturnChainType,
  IdentifierReturnChainType,
  IdentifierType,
  IdentifierTypeName,
  ReturnChainType,
  ValueDescription,
  ValueDescriptionDictionary,
  ValueDescriptionDictionaryFunctionKey,
  ValueDescriptor
} from './base';
import {determineReturnIdentifierTypeOfFunction} from "./utils";
import {CodeDocument} from "@monaco-imposture-tools/core";

export const globalValueDescriptor:ValueDescriptor = {
  _$functionReturnType: createPkgValDesc(
    [],
    {
      pipeline: createPkgValDesc(
        [
          "**Return package pipeline**",
          "Package pipeline",
        ],
        {
          DataFactory: createRefValDesc(
            ['Name of the data factory the pipeline run is running within'],
            IdentifierType.String
          ),
          Pipeline: createRefValDesc(
            ['Pipeline Name'],
            IdentifierType.String
          ),
          GroupId: createRefValDesc(
            ['ID of the group to which the pipeline run belongs'],
            IdentifierType.String
          ),
          RunId: createRefValDesc(
            ['ID of the specific pipeline run'],
            IdentifierType.String
          ),
          TriggerId: createRefValDesc(
            ['ID of the trigger that invokes the pipeline'],
            IdentifierType.String
          ),
          TriggerName: createRefValDesc(
            ['Name of the trigger that invokes the pipeline'],
            IdentifierType.String
          ),
          TriggerTime: createRefValDesc(
            ['Time when the trigger that invoked the pipeline. The trigger time is the actual fired time, not the scheduled time. For example, 13:20:08.0149599Z is returned instead of 13:20:00.00Z'],
            IdentifierType.String
          ),
          TriggerType: createRefValDesc(
            ['Type of the trigger that invoked the pipeline (Manual, Scheduler)'],
            IdentifierType.String
          ),
          TriggeredByPipelineName: createRefValDesc(
            ['Name of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.'],
            IdentifierType.String, true,
          ),
          TriggeredByPipelineRunId: createRefValDesc(
            ['Run ID of the pipeline that triggered this pipeline. Applicable when a pipeline run is triggered by an Execute Pipeline activity; Evaluates to Null when used in other circumstances.'],
            IdentifierType.String, true
          ),
        }
      ),
    }
  ),
  ...createPkgValDesc(
    [],
    {
      // system variables
      pipeline: createFunValDesc(
        [
          "**pipeline()**",
          "Return pipeline object",
        ],
        [],
        IdentifierType.FUNCTION_RETURN_TYPE(["_$functionReturnType", 'pipeline'])
      ),
      // collection functions
      contains: createOverloadedFunValDesc(
        [
          "**contains(string, string):boolean**",
          "**contains(array, array):boolean**",
          "**contains(object, object):boolean**",
          "Check whether a collection has a specific item.",
        ],
        [
          [IdentifierType.String, IdentifierType.String],
          [IdentifierType.Array, IdentifierType.Array],
          [IdentifierType.AnyObject, IdentifierType.AnyObject]
        ],
        [
          IdentifierType.Boolean,
          IdentifierType.Boolean,
          IdentifierType.Boolean
        ]
      ),
      empty: createOverloadedFunValDesc(
        [
          "**empty(string):boolean**",
          "**empty(array):boolean**",
          "**empty(object):boolean**",
          "Returns true if object, array, or string is empty. For example, the following expression returns true: empty('')",
        ],
        [
          [IdentifierType.String],
          [IdentifierType.Array],
          [IdentifierType.AnyObject]
        ],
        [
          IdentifierType.Boolean,
          IdentifierType.Boolean,
          IdentifierType.Boolean
        ]
      ),
      first: createOverloadedFunValDesc(
        [
          "**empty(string):boolean**",
          "**empty(array):boolean**",
          "Returns the first element in the array or string passed in. For example, this function returns 0: first([0,2,3])",
        ],
        [
          [IdentifierType.String],
          [IdentifierType.Array],
        ],
        [
          IdentifierType.Boolean,
          IdentifierType.Boolean
        ]
      ),
      intersection: createOverloadedFunValDesc(
        [
          "**intersection(object, object):object**",
          "**intersection(array, array):array**",
          "Returns a single array or object with the common elements between the arrays or objects passed to it. For example, this function returns [1, 2]: intersection([1, 2, 3], [101, 2, 1, 10],[6, 8, 1, 2]). The parameters for the function can either be a set of objects or a set of arrays (not a mixture thereof). If there are two objects with the same name, the last object with that name appears in the final object.",
        ],
        [
          [IdentifierType.AnyObject, IdentifierType.AnyObject],
          [IdentifierType.Array, IdentifierType.Array],
        ],
        [
          IdentifierType.AnyObject,
          IdentifierType.Array
        ]
      ),
      join: createOverloadedFunValDesc(
        [
          "**join(object, object):string**",
          "**join(array, array):string**",
          "Return a string that has all the items from an array and has each character separated by a delimiter.",
        ],
        [
          [IdentifierType.String, IdentifierType.String],
          [IdentifierType.Array, IdentifierType.Array],
        ],
        [
          IdentifierType.String,
          IdentifierType.String
        ]
      ),
      last: createOverloadedFunValDesc(
        [
          "**last(string):string**",
          "**last(array):any**",
          "Returns the last element in the array or string passed in. For example, this function returns 3: last([0,2,3])",
        ],
        [
          [IdentifierType.String],
          [IdentifierType.Array],
        ],
        [
          IdentifierType.String,
          IdentifierType.Any
        ]
      ),
      length:createOverloadedFunValDesc(
        [
          "**length(string):number**",
          "**length(array):number**",
          "Returns the last element in the array or string passed in. For example, this function returns 3: last([0,2,3])",
        ],
        [
          [IdentifierType.String],
          [IdentifierType.Array],
        ],
        [
          IdentifierType.Number,
          IdentifierType.Number
        ]
      ),
      skip:createOverloadedFunValDesc(
        [
          "**skip(array):array**",
          "**skip(integer):array**",
          "Returns the elements in the array starting at index Count, for example this function returns [3, 4]: skip([1, 2 ,3 ,4], 2)",
        ],
        [
          [IdentifierType.Array],
          [IdentifierType.Number],
        ],
        [
          IdentifierType.String,
          IdentifierType.String
        ]
      ),
      take:createOverloadedFunValDesc(
        [
          "**take(array, number):array**",
          "**take(string, number):array**",
          "Returns the first Count elements from the array or string passed in, for example this function returns [1, 2]: take([1, 2, 3, 4], 2)",
        ],
        [
          [IdentifierType.Array, IdentifierType.Number],
          [IdentifierType.String, IdentifierType.Number],
        ],
        [
          IdentifierType.Number,
          IdentifierType.Number
        ]
      ),
      union:createOverloadedFunValDesc(
        [
          "**union(array, number):array**",
          "**union(string, number):array**",
          "Returns a single array or object with all of the elements that are in either array or object passed to it. For example, this function returns [1, 2, 3, 10, 101] : union([1, 2, 3], [101, 2, 1, 10]). The parameters for the function can either be a set of objects or a set of arrays (not a mixture thereof). If there are two objects with the same name in the final output, the last object with that name appears in the final object.",
        ],
        [
          [IdentifierType.ArrayList,],
          [IdentifierType.AnyObjectList,],
        ],
        [
          IdentifierType.Array,
          IdentifierType.AnyObject
        ]
      ),
      //*********conversion functions
      array: createFunValDesc(
        [
          "**array(...string):string**",
          "Convert the parameter to an array. For example, the following expression returns [\"abc\"]: array('abc')",
        ],
        [IdentifierType.ArrayList],
        IdentifierType.Array
      ),
      base64: createFunValDesc(
        [
          "**base64(string):string**",
          "Return the base64-encoded version for a string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      base64ToBinary: createFunValDesc(
        [
          "**base64ToBinary(string):string**",
          "Return the base64-encoded version for a string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      base64ToString: createFunValDesc(
        [
          "**base64ToString(string):string**",
          "Return the string version for a base64-encoded string, effectively decoding the base64 string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      binary: createFunValDesc(
        [
          "**binary(string):string**",
          "Return the binary version for a string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      bool: createFunValDesc(
        [
          "**bool(any):string**",
          "Return the Boolean version for a value."
        ],
        [IdentifierType.AnyObject],
        IdentifierType.Boolean
      ),
      coalesce: createFunValDesc(
        [
          "**coalesce(...any[]):any**",
          "Return the first non-null value from one or more parameters. Empty strings, empty arrays, and empty objects are not null."
        ],
        [IdentifierType.ArrayList],
        IdentifierType.Any
      ),
      createArray: createFunValDesc(
        [
          "**createArray(...any[]):any[]**",
          "Return an array from multiple inputs."
        ],
        [IdentifierType.ArrayList],
        IdentifierType.Array
      ),
      dataUri: createFunValDesc(
        [
          "**dataUri(string):string**",
          "Return a data uniform resource identifier (URI) for a string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      dataUriToBinary: createFunValDesc(
        [
          "**dataUriToBinary(string):string**",
          "Return the binary version for a data uniform resource identifier (URI). "
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      dataUriToString: createFunValDesc(
        [
          "**dataUriToString(string):string**",
          "Return the string version for a data uniform resource identifier (URI)."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      decodeBase64: createFunValDesc(
        [
          "**decodeBase64(string):string**",
          "Return the string version for a base64-encoded string, effectively decoding the base64 string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      decodeDataUri: createFunValDesc(
        [
          "**decodeDataUri(string):string**",
          "Return the binary version for a data uniform resource identifier (URI)."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      decodeUriComponent: createFunValDesc(
        [
          "**decodeUriComponent(string):string**",
          "Return a string that replaces escape characters with decoded versions."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      encodeUriComponent: createFunValDesc(
        [
          "**encodeUriComponent(string):string**",
          "Return a uniform resource identifier (URI) encoded version for a string by replacing URL-unsafe characters with escape characters."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      float: createFunValDesc(
        [
          "**float(string):number**",
          "Convert a string version for a floating-point number to an actual floating point number."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      int: createFunValDesc(
        [
          "**int(string):number**",
          "Return the integer version for a string."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      json: createOverloadedFunValDesc(
        [
          "**json(string|xml):object**",
          "Return the JavaScript Object Notation (JSON) type value or object for a string or XML."
        ],
        [
          [IdentifierType.String],
          [IdentifierType.XML],
        ],
        [
          IdentifierType.AnyObject,
          IdentifierType.AnyObject,
        ]
      ),
      string: createFunValDesc(
        [
          "**string(any):string**",
          "Return the string version for a value."
        ],
        [IdentifierType.Any],
        IdentifierType.String
      ),
      uriComponentToBinary: createFunValDesc(
        [
          "**uriComponentToBinary(string):string**",
          "Return the binary version for a uniform resource identifier (URI) component."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      uriComponentToString: createFunValDesc(
        [
          "**uriComponentToString(string):string**",
          "Return the string version for a uniform resource identifier (URI) encoded string, effectively decoding the URI-encoded string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      xml: createFunValDesc(
        [
          "**xml(string):object**",
          "Return the XML version for a string that contains a JSON object."
        ],
        [IdentifierType.String],
        IdentifierType.AnyObject
      ),
      xpath: createFunValDesc(
        [
          "**xpath(any, any):any**",
          "Check XML for nodes or values that match an XPath (XML Path Language) expression, and return the matching nodes or values. An XPath expression, or just \"XPath\", helps you navigate an XML document structure so that you can select nodes or compute values in the XML content."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Any
      ),
      //*********date functions
      addToTime:createFunValDesc(
        [
          "**addToTime(string, number, string, string):string**",
          "Add a number of time units to a timestamp. "
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      addDays:createFunValDesc(
        [
          "**addDays(string, number, string):string**",
          "Add a number of days to a timestamp."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        IdentifierType.String
      ),
      addHours:createFunValDesc(
        [
          "**addHours(string, number, string):string**",
          "Add a number of hours to a timestamp."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        IdentifierType.String
      ),
      addMinutes:createFunValDesc(
        [
          "**addMinutes(string, number, string):string**",
          "Add a number of minutes to a timestamp."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        IdentifierType.String
      ),
      addSeconds:createFunValDesc(
        [
          "**addSeconds(string, number, string):string**",
          "Add a number of seconds to a timestamp."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String],
        IdentifierType.String
      ),
      convertFromUtc:createFunValDesc(
        [
          "**convertFromUtc(string, string, string):string**",
          "Convert a timestamp from Universal Time Coordinated (UTC) to the target time zone."
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      convertTimeZone:createFunValDesc(
        [
          "**convertTimeZone(string, string, string):string**",
          "Convert a timestamp from the source time zone to the target time zone."
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      convertToUtc:createFunValDesc(
        [
          "**convertToUtc(string, string, string):string**",
          "Convert a timestamp from the source time zone to Universal Time Coordinated (UTC)."
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      dayOfMonth:createFunValDesc(
        [
          "**dayOfMonth(string):Integer**",
          "Return the day of the month from a timestamp."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      dayOfWeek:createFunValDesc(
        [
          "**dayOfWeek(string):Integer**",
          "Return the day of the week from a timestamp."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      dayOfYear:createFunValDesc(
        [
          "**dayOfYear(string):Integer**",
          "Return the day of the year from a timestamp."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      formatDateTime:createFunValDesc(
        [
          "**formatDateTime(string, string):string**",
          "Return a timestamp in the specified format."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      getFutureTime:createFunValDesc(
        [
          "**getFutureTime(number, string, string):string**",
          "Return the current timestamp plus the specified time units."
        ],
        [IdentifierType.Number, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      getPastTime:createFunValDesc(
        [
          "**getPastTime(number, string, string):string**",
          "Return the current timestamp minus the specified time units."
        ],
        [IdentifierType.Number, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      startOfDay:createFunValDesc(
        [
          "**startOfDay(string, string):string**",
          "Return the start of the day for a timestamp."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      startOfHour:createFunValDesc(
        [
          "**startOfHour(string, string):string**",
          "Return the start of the hour for a timestamp."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      startOfMonth:createFunValDesc(
        [
          "**startOfMonth(string, string):string**",
          "Return the start of the month for a timestamp."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      subtractFromTime:createFunValDesc(
        [
          "**subtractFromTime(string, integer, string, string):string**",
          "Subtract a number of time units from a timestamp. See also getPastTime."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      ticks:createFunValDesc(
        [
          "**ticks(string):Integer**",
          "Return the ticks property value for a specified timestamp. A tick is a 100-nanosecond interval."
        ],
        [IdentifierType.String],
        IdentifierType.Number
      ),
      utcNow:createFunValDesc(
        [
          "**utcNow(string):string**",
          "Return the current timestamp."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      //*********logical functions
      and:createFunValDesc(
        [
          "**and(boolean, boolean):boolean**",
          "Check whether both expressions are true. Return true when both expressions are true, or return false when at least one expression is false."
        ],
        [IdentifierType.Boolean, IdentifierType.Boolean],
        IdentifierType.Boolean
      ),
      equals:createFunValDesc(
        [
          "**equals(any, any):boolean**",
          "Check whether both values, expressions, or objects are equivalent. Return true when both are equivalent, or return false when they're not equivalent."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Boolean
      ),
      greater:createFunValDesc(
        [
          "**greater(any, any):boolean**",
          "Check whether the first value is greater than the second value. Return true when the first value is more, or return false when less."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Boolean
      ),
      greaterOrEquals:createFunValDesc(
        [
          "**greaterOrEquals(any, any):boolean**",
          "Check whether the first value is greater than or equal to the second value. Return true when the first value is greater or equal, or return false when the first value is less."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Boolean
      ),
      if:createFunValDesc(
        [
          "**if(boolean, any, any):any**",
          "Check whether an expression is true or false. Based on the result, return a specified value."
        ],
        [IdentifierType.Boolean, IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Any
      ),
      less:createFunValDesc(
        [
          "**less(any, any):boolean**",
          "Check whether the first value is less than the second value. Return true when the first value is less, or return false when the first value is more."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Boolean
      ),
      lessOrEquals:createFunValDesc(
        [
          "**lessOrEquals(any, any):boolean**",
          "Check whether the first value is less than or equal to the second value. Return true when the first value is less than or equal, or return false when the first value is more."
        ],
        [IdentifierType.Any, IdentifierType.Any],
        IdentifierType.Boolean
      ),
      not:createFunValDesc(
        [
          "**not(boolean):boolean**",
          "Check whether an expression is false. Return true when the expression is false, or return false when true."
        ],
        [IdentifierType.Boolean],
        IdentifierType.Boolean
      ),
      or:createFunValDesc(
        [
          "**or(boolean, boolean):boolean**",
          "Check whether at least one expression is true. Return true when at least one expression is true, or return false when both are false."
        ],
        [IdentifierType.Boolean, IdentifierType.Boolean],
        IdentifierType.Boolean
      ),
      //*********Math functions
      add:createFunValDesc(
        [
          "**add(number, number):number**",
          "Return the result from adding two numbers."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      div:createFunValDesc(
        [
          "**div(number, number):number**",
          "Return the integer result from dividing two numbers. To get the remainder result, see mod()."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      max:createFunValDesc(
        [
          "**max(...number[]):number**",
          "Return the highest value from a list or array with numbers that is inclusive at both ends."
        ],
        [IdentifierType.NumberArray],
        IdentifierType.Number
      ),
      min:createFunValDesc(
        [
          "**min(...number[]):number**",
          "Return the lowest value from a set of numbers or an array."
        ],
        [IdentifierType.NumberArray],
        IdentifierType.Number
      ),
      mod:createFunValDesc(
        [
          "**mod(number, number):number**",
          "Return the remainder from dividing two numbers. To get the integer result, see div()."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      mul:createFunValDesc(
        [
          "**mul(number, number):number**",
          "Return the product from multiplying two numbers."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      rand:createFunValDesc(
        [
          "**rand(number, number):number**",
          "Return a random integer from a specified range, which is inclusive only at the starting end."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      range:createFunValDesc(
        [
          "**range(number, number):number**",
          "Return an integer array that starts from a specified integer."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.NumberArray
      ),
      sub:createFunValDesc(
        [
          "**sub(number, number):number**",
          "Return the result from subtracting the second number from the first number."
        ],
        [IdentifierType.Number, IdentifierType.Number],
        IdentifierType.Number
      ),
      //*********String functions
      concat:createFunValDesc(
        [
          "**concat(...string[]):string**",
          "Combine two or more strings, and return the combined string."
        ],
        [IdentifierType.StringArrayList],
        IdentifierType.String
      ),
      endswith:createFunValDesc(
        [
          "**endswith(string, string):boolean**",
          "Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.Boolean
      ),
      guid:createOverloadedFunValDesc(
        [
          "**guid():string**",
          "**guid(string):string**",
          "Check whether a string ends with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive."
        ],
        [
          [],
          [IdentifierType.String]
        ],
        [
          IdentifierType.String,
          IdentifierType.String,
        ]
      ),
      indexOf:createFunValDesc(
        [
          "**indexOf(string, string):number**",
          "Return the starting position or index value for a substring. This function is not case-sensitive, and indexes start with the number 0."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.Number
      ),
      lastIndexOf:createFunValDesc(
        [
          "**lastIndexOf(string, string):number**",
          "Return the starting position or index value for the last occurrence of a substring. This function is not case-sensitive, and indexes start with the number 0."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.Number
      ),
      replace:createFunValDesc(
        [
          "**replace(string, string, string):string**",
          "Replace a substring with the specified string, and return the result string. This function is case-sensitive."
        ],
        [IdentifierType.String, IdentifierType.String, IdentifierType.String],
        IdentifierType.String
      ),
      split:createFunValDesc(
        [
          "**split(string, string):string[]**",
          "Return an array that contains substrings, separated by commas, based on the specified delimiter character in the original string."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.StringArrayList
      ),
      startswith:createFunValDesc(
        [
          "**startswith(string, string):boolean**",
          "Check whether a string starts with a specific substring. Return true when the substring is found, or return false when not found. This function is not case-sensitive."
        ],
        [IdentifierType.String, IdentifierType.String],
        IdentifierType.Boolean
      ),
      substring:createFunValDesc(
        [
          "**substring(string, number, number):string**",
          "Return characters from a string, starting from the specified position, or index. Index values start with the number 0."
        ],
        [IdentifierType.String, IdentifierType.Number, IdentifierType.Number],
        IdentifierType.String
      ),
      toLower:createFunValDesc(
        [
          "**toLower(string):string**",
          "Return a string in lowercase format. If a character in the string doesn't have a lowercase version, that character stays unchanged in the returned string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      toUpper:createFunValDesc(
        [
          "**toUpper(string):string**",
          "Return a string in uppercase format. If a character in the string doesn't have an uppercase version, that character stays unchanged in the returned string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      trim:createFunValDesc(
        [
          "**trim(string):string**",
          "Remove leading and trailing whitespace from a string, and return the updated string."
        ],
        [IdentifierType.String],
        IdentifierType.String
      ),
      //*********Variables
      variables:createFunValDesc(
        [
          "**variables(string):any**",
          "Return the varialbe from the Data factory"
        ],
        [IdentifierType.String],
        IdentifierType.Any
      )
    }
  ),
}

export const globalValueDescriptorDict = generateValueDescriptionDictionary(globalValueDescriptor);

export function isValueDescriptor(node:any){
  return node?._$type && (
    node._$type === DescriptionType.FunctionValue ||
    node._$type === DescriptionType.OverloadedFunctionValue ||
    node._$type === DescriptionType.PackageReference ||
    node._$type === DescriptionType.ReferenceValue
  )
}

export function traverseDescriptor(descriptor:ValueDescription, paths:string[], cb:(paths:string[], vd:ValueDescription)=>void){
  paths = paths.slice();
  if (isValueDescriptor(descriptor)){
    switch (descriptor._$type){
      case DescriptionType.FunctionValue:
      case DescriptionType.OverloadedFunctionValue:
      case DescriptionType.ReferenceValue:
        cb(paths, descriptor)
        break;
      case DescriptionType.PackageReference:
        for (const [key, value] of Object.entries(descriptor._$subDescriptor)){
          if (!key.startsWith('_$')){
            traverseDescriptor(value, [...paths, key], cb);
          }
        }
        break;
    }
  }
  return ;
}

function generateValueDescriptionDictionary(descriptor:ValueDescriptor):ValueDescriptionDictionary{
  const result:ValueDescriptionDictionary = new Map<IdentifierType | string, DescriptorCollection[]>([
    [ValueDescriptionDictionaryFunctionKey,[]],
    [IdentifierType.Any,[]],
    [IdentifierType.Boolean,[]],
    [IdentifierType.String,[]],
    [IdentifierType.Number,[]],
    [IdentifierType.AnyObject,[]],
    [IdentifierType.Array,[]],
    [IdentifierType.StringArray,[]],
    [IdentifierType.NumberArray,[]],
    [IdentifierType.Null,[]],
    [IdentifierType.XML,[]],
    [IdentifierType.ArrayList,[]],
    [IdentifierType.StringArrayList,[]],
    [IdentifierType.NumberArrayList,[]],
    [IdentifierType.AnyObjectList,[]],
  ]);

  function saveToDescriptionDictionary(paths:string[], vd:ValueDescription) {
    switch (vd._$type) {
      case DescriptionType.FunctionValue:
        if (
          vd._$returnType.type === IdentifierTypeName.FUNCTION_RETURN_TYPE
        ){
          const dynamicReturnType =  vd._$returnType;
          const targetResult = (result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []) as DescriptorCollection[];
          result.set(dynamicReturnType, targetResult);
          targetResult.push({
            paths,
            valDescCollItem:DescriptorCollectionItem.BASIC(vd)
          });
          if (
            vd._$parameterTypes.length === 0 &&
            vd._$returnType.returnTypeChainList?.length &&
            vd._$returnType.returnTypeChainList[0] === '_$functionReturnType'
          ){
            // alright we gotta empty para function returning obj type and need to populate its children to the completion list
            // first find the return descriptor
            const retValDesc = findAmongOneDescriptor(globalValueDescriptor, vd._$returnType.returnTypeChainList);
            // if the return description existed, we could populate items traversing the description
            if (retValDesc){
              traverseDescriptor(retValDesc, [], (rtPaths, rtVd) => {
                if (rtVd._$type === DescriptionType.ReferenceValue){
                  if (rtVd._$valueType.type === IdentifierTypeName.OBJECT){
                    const dynamicReturnType =  rtVd._$valueType;
                    const targetResult = (result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []) as DescriptorCollection[];
                    result.set(dynamicReturnType, targetResult);
                    targetResult.push({
                      paths,
                      valDescCollItem:DescriptorCollectionItem.EMPTY_PARA_FUN_RET( vd, rtPaths, rtVd)
                    });
                  }else{
                    result.get(rtVd._$valueType)!.push({
                      paths,
                      valDescCollItem:DescriptorCollectionItem.EMPTY_PARA_FUN_RET( vd, rtPaths, rtVd)
                    });
                  }
                }
              });
            }
          }
        }else{
          result.get(vd._$returnType)!.push({
            paths,
            valDescCollItem:DescriptorCollectionItem.BASIC(vd)
          });
        }
        result.get(ValueDescriptionDictionaryFunctionKey)!.push({
          paths,
          valDescCollItem:DescriptorCollectionItem.BASIC(vd)
        });
        break;
      case DescriptionType.OverloadedFunctionValue:
        vd._$returnType.forEach((oneReturnType, olRtIndex) => {
          if (
            oneReturnType.type === IdentifierTypeName.FUNCTION_RETURN_TYPE
          ){
            const dynamicReturnType =  oneReturnType;
            const targetResult = (result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []) as DescriptorCollection[];
            result.set(dynamicReturnType, targetResult);
            targetResult.push({
              paths,
              valDescCollItem:DescriptorCollectionItem.OVERLOADED_FUN(vd, olRtIndex)
            });
            if (
              vd._$parameterTypes[olRtIndex].length === 0 &&
              vd._$returnType[olRtIndex].returnTypeChainList?.length &&
              vd._$returnType[olRtIndex].returnTypeChainList![0] === '_$functionReturnType'
            ){
              // alright, among an overload function, we gotta empty para function returning obj type and need to populate its children to the completion list
              // first find the return descriptor
              const retValDesc = findAmongOneDescriptor(globalValueDescriptor, vd._$returnType[olRtIndex].returnTypeChainList!);
              // if the return description existed, we could populate items traversing the description
              if (retValDesc){
                traverseDescriptor(retValDesc, [], (olRtPaths, olRtVd) => {
                  if (olRtVd._$type === DescriptionType.ReferenceValue){
                    if (olRtVd._$valueType.type === IdentifierTypeName.OBJECT){
                      const dynamicReturnType =  olRtVd._$valueType;
                      const targetResult = (result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []) as DescriptorCollection[];
                      result.set(dynamicReturnType, targetResult);
                      targetResult.push({
                        paths,
                        valDescCollItem:DescriptorCollectionItem.EMPTY_PARA_FUN_RET( vd, olRtPaths, olRtVd, olRtIndex)
                      });
                    }else{
                      result.get(olRtVd._$valueType)!.push({
                        paths,
                        valDescCollItem:DescriptorCollectionItem.EMPTY_PARA_FUN_RET( vd, olRtPaths, olRtVd, olRtIndex)
                      });
                    }
                  }
                });
              }
            }
          }else{
            result.get(oneReturnType)!.push({
              paths,
              valDescCollItem:DescriptorCollectionItem.OVERLOADED_FUN(vd, olRtIndex)
            });
          }
          result.get(ValueDescriptionDictionaryFunctionKey)!.push({
            paths,
            valDescCollItem:DescriptorCollectionItem.OVERLOADED_FUN(vd, olRtIndex)
          });
        })
        break;
      case DescriptionType.ReferenceValue:
        if (vd._$valueType.type === IdentifierTypeName.OBJECT){
          const dynamicReturnType =  vd._$valueType;
          const targetResult = (result.has(dynamicReturnType) ? result.get(dynamicReturnType) : []) as DescriptorCollection[];
          result.set(dynamicReturnType, targetResult);
          targetResult.push({
            paths,
            valDescCollItem:DescriptorCollectionItem.BASIC(vd)
          });
        }else{
          result.get(vd._$valueType)!.push({
            paths,
            valDescCollItem:DescriptorCollectionItem.BASIC(vd)
          });
        }
        break;
      case DescriptionType.PackageReference:
        // should never reach over here
        break;
    }
  }

  // traverseDescriptor(descriptor._$functionReturnType, ['_$functionReturnType'], saveToDescriptionDictionary)
  traverseDescriptor(descriptor, [], saveToDescriptionDictionary)

  // todo might need to wrap it into a frozen map
  return result;
}

export function findAmongOneDescriptor(descriptor:ValueDescriptor, paths:string[]):ValueDescription|undefined{
  if (!paths.length) return;
  paths = paths.slice();

  const firstPath = paths.shift();
  if (!firstPath) return;
  let valDesc: ValueDescription|undefined = undefined;
  if (
    firstPath === '_$functionReturnType' &&
    firstPath in descriptor
  ){
    valDesc = descriptor[firstPath];
  }else if (descriptor._$type === DescriptionType.PackageReference){
    valDesc = descriptor._$subDescriptor[firstPath];
  }
  if (!valDesc) return;

  let cur = valDesc;
  let curPath = paths.shift();
  while (
    cur && curPath && cur._$type === DescriptionType.PackageReference
  ){
    cur = cur._$subDescriptor[curPath];
    curPath = paths.shift();
  }
  if (isValueDescriptor(cur)){
    if (cur._$type === DescriptionType.ReferenceValue){
      if (cur._$valueType.isAnyObject){
        return cur;
      }
    }
    if (paths.length === 0) return cur;
  }
  return ;
}

export function findAmongGlobalDescription(paths:string[]){
  return findAmongOneDescriptor(globalValueDescriptor, paths);
}

export function collectAllPathBeneathOneDescriptorNode(descriptorNode:ValueDescription, paths:string[], collector:DescriptorCollection[]){
  if (!descriptorNode) return;
  if (descriptorNode._$type === DescriptionType.PackageReference){
    for (const [key, value] of Object.entries(descriptorNode._$subDescriptor)){
      if (!key.startsWith('_$')){
        collectAllPathBeneathOneDescriptorNode(value, [...paths, key], collector);
      }
    }
  }else{
    collector.push({
      paths: paths.slice(),
      valDescCollItem: DescriptorCollectionItem.BASIC(descriptorNode)
    });
  }
  return;
}

export function findAllPathAmongOneDescriptor(descriptor:ValueDescription, paths:string[]):DescriptorCollection[]{
  const collector:DescriptorCollection[] = [];
  const originalPathsCopy = paths.slice();
  paths = paths.slice();
  let cur = descriptor;
  if (paths.length){
    let curPath = paths.shift();
    while (
      cur && curPath && cur._$type === DescriptionType.PackageReference
    ){
      cur = cur._$subDescriptor[curPath];
      curPath = paths.shift();
    }
  }
  if (paths.length === 0){
    collectAllPathBeneathOneDescriptorNode(cur, originalPathsCopy, collector);
  }
  return collector;
}

export function findAllPathAmongGlobal(paths:string[]){
  return findAllPathAmongOneDescriptor(globalValueDescriptor, paths);
}

export function findValueDescriptionFromChain(codeDocument:CodeDocument, idChain:ReturnChainType[]): ValueDescription| undefined{
  if (idChain.length === 0) return;
  if (idChain[0].type === 'function-call-complete'){
    const functionFullName = idChain[0].functionFullName;
    const theFunDesc = findAmongGlobalDescription(functionFullName.split('.'));
    if (theFunDesc){
      let retTyp: IdentifierType | undefined = determineReturnIdentifierTypeOfFunction(
        codeDocument,
        idChain[0].node as any,
        theFunDesc
      );
      if (
        retTyp &&
        retTyp.type === IdentifierTypeName.FUNCTION_RETURN_TYPE &&
        retTyp.returnTypeChainList?.length
      ){
        // todo, enhancement: it would be a lot of better to return which part of the chain not found
        return findAmongGlobalDescription([
          ...retTyp.returnTypeChainList,
          ...(idChain.slice(1) as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
            .map(value => value.identifierName)
        ]);
      }

    }
  }else if (
    'identifierName' in idChain[0] &&
    idChain[0].identifierName
  ){
    return findAmongGlobalDescription(
      (idChain as (IdentifierInBracketNotationReturnChainType|IdentifierReturnChainType)[])
        .map(value => value.identifierName)
    );
  }
  return
}

export function findAllRootPackageOfOneDescriptor(descriptor:any = globalValueDescriptor):DescriptorCollection<[string]>[]{
  const collector:DescriptorCollection<[string]>[] = [];
  if (descriptor._$type === DescriptionType.PackageReference){
    for (const [key, value] of Object.entries(descriptor._$subDescriptor)){
      if (!key.startsWith('_$') && isValueDescriptor(value)){
        const vd = value as ValueDescription;
        switch (vd._$type) {
          case DescriptionType.OverloadedFunctionValue:
            vd._$parameterTypes.forEach((_val, index) => {
              collector.push({
                paths: [key],
                valDescCollItem: DescriptorCollectionItem.OVERLOADED_FUN(vd, index)
              });
            });
            break;
          case DescriptionType.FunctionValue:
          case DescriptionType.PackageReference:
          case DescriptionType.ReferenceValue:
            // todo populate empty para fun return refs
            collector.push({
              paths: [key],
              valDescCollItem: DescriptorCollectionItem.BASIC(vd)
            });
            break;
        }
      }
    }
  }
  return collector;
}
