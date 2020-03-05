import {ActionHandler} from "../module";
import {Module} from "../platform/Module";
import {State} from "../reducer";
import {app} from "../app";
import {stringifyWithMask} from "../util/json-util";
import {Logger} from "../Logger";
import {SagaIterator} from "../typed-saga";

export {Interval} from "./Interval";
export {Lifecycle} from "./Lifecycle";
export {Loading} from "./Loading";
export {Log} from "./Log";
export {Mutex} from "./Mutex";
export {RetryOnNetworkConnectionError} from "./RetryOnNetworkConnectionError";
export {SilentOnNetworkConnectionError} from "./SilentOnNetworkConnectionError";
export {TimeLimit} from "./TimeLimit";

/**
 * Decorator type declaration, required by TypeScript.
 */
type HandlerDecorator = (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<ActionHandler>) => TypedPropertyDescriptor<ActionHandler>;
type VoidFunctionDecorator = (target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => void>) => TypedPropertyDescriptor<(...args: any[]) => void>;

type ActionHandlerWithMetaData = ActionHandler & {actionName: string; maskedParams: string};

type HandlerInterceptor<RootState extends State = State, ModuleState extends {} = {}> = (handler: ActionHandlerWithMetaData, thisModule: Module<ModuleState, {}, RootState>) => SagaIterator;
type FunctionInterceptor<S> = (handler: () => void, rootState: Readonly<S>, logger: Logger) => void;

/**
 * A helper for ActionHandler functions (Saga).
 */
export function createActionHandlerDecorator<RootState extends State = State, ModuleState extends {} = {}>(interceptor: HandlerInterceptor<RootState, ModuleState>): HandlerDecorator {
    return (target, propertyKey, descriptor) => {
        const fn = descriptor.value!;
        descriptor.value = function*(...args: any[]): SagaIterator {
            const boundFn: ActionHandlerWithMetaData = fn.bind(this, ...args) as any;
            // Do not use fn.actionName, it returns undefined
            // The reason is, fn is created before module register(), and the actionName had not been attached then
            boundFn.actionName = (descriptor.value as any).actionName;
            boundFn.maskedParams = stringifyWithMask(app.loggerConfig?.maskedKeywords || [], "***", ...args) || "[No Parameter]";
            yield* interceptor(boundFn, this as any);
        };
        return descriptor;
    };
}

/**
 * A helper for regular functions.
 */
export function createRegularDecorator<S extends State = State>(interceptor: FunctionInterceptor<S>): VoidFunctionDecorator {
    return (target, propertyKey, descriptor) => {
        const fn = descriptor.value!;
        descriptor.value = function(...args: any[]) {
            const rootState: S = app.store.getState() as S;
            const logger = app.logger;
            interceptor(fn.bind(this, ...args), rootState, logger);
        };
        return descriptor;
    };
}
