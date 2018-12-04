import * as React from 'react';
import { Subject,Observable, BehaviorSubject, OperatorFunction, identity } from 'rxjs';
import {map, distinctUntilChanged, scan} from "rxjs/operators"

export type Mutation<T> = (t:T)=>T

export type Store<T> = {
    stream:Observable<T>,
    next(m:Mutation<T>):void,
    destroy():void
}

export function createStore<T>(defaultState:T, middleware:OperatorFunction<Mutation<T>,Mutation<T>>=identity):Store<T>{
    const mutations = new Subject<Mutation<T>>()
    const stream = new BehaviorSubject(defaultState)

    mutations.pipe(
        middleware,
        scan<Mutation<T>,T>((state,mutation)=>{
            return mutation(state)
        },defaultState)
    ).subscribe(stream)

    return {
        stream,
        next(m){
            mutations.next(m)
        },
        //we don't use the name `complete` because it will cause store to terminate when you use pattern like .subscribe(store)
        destroy(){ 
            mutations.complete()
            stream.complete()
        }
    }
}

export function useSink<T>(operation:(sub:Subject<T>)=>void,deps:any[]=[]):Subject<T>['next']{
    const [sub,next] = React.useMemo<[Subject<T>,Subject<T>['next']]>(()=>{
        const sub = new Subject<T>()
        return [sub,sub.next.bind(sub)]
    },deps)
    React.useEffect(()=>{
        operation(sub)
        return ()=>sub.complete()
    },[sub])
    return next
}

export function useObservable<T>(ob:Observable<T>){
    const [value,setValue] = React.useState<T|null>(null)
    React.useEffect(()=>{
        const sub = ob.subscribe(setValue)
        return sub.unsubscribe.bind(sub)
    },[ob])
    return value
}

export function useSource<State,Slice=State>(ob:Observable<State>,operator:(s:Observable<State>)=>Observable<Slice>=map(x=>x as any),deps:any[]=[]){
    const selected = React.useMemo(()=>{
        return ob.pipe(
            operator,
            distinctUntilChanged<Slice>(shallowEqual),
        )
    },[ob,...deps])
    return useObservable(selected)
}

function shallowEqual(a:any,b:any){
    if(a===b)
        return true
    if(a==undefined || b==undefined)
        return false
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if(ka.length !== kb.length)
        return false
    return ka.every(k=>a[k] === b[k])
}