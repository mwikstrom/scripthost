<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [scripthost](./scripthost.md) &gt; [GenericMessage](./scripthost.genericmessage.md)

## GenericMessage interface

Generic message

<b>Signature:</b>

```typescript
export interface GenericMessage<T extends string = string> extends Partial<ScriptObject> 
```
<b>Extends:</b> Partial&lt;[ScriptObject](./scripthost.scriptobject.md)<!-- -->&gt;

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [messageId](./scripthost.genericmessage.messageid.md) | string | Unique message identifier |
|  [type](./scripthost.genericmessage.type.md) | T | Message discriminator |
