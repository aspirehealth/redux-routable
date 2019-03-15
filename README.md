# Redux Routable

A simple [Redux middleware](https://redux.js.org/advanced/middleware) for
routing. Define the routes of your application, dispatch actions to navigate,
and actions will be dispatched whenever the route changes.

## Overview

- Use declarative functions to define your router.
- Dispatch [navigation actions](#navigation-action-creators) to change the
  location, open a route in a new tab, or go back or forward in history.
- Listen for the `ROUTE_CHANGED` action in your reducers to persist and execute
  side effects for the route and parameters.

## Installation

```shell
npm install --save @redux-routable/core
```

Along with installing this package, you'll also need to have
[`redux`](https://www.npmjs.com/package/redux#installation) and
[`history`](https://www.npmjs.com/package/history#installation) installed.

## Usage

Given that Redux Routable is Redux middleware, you'll need to have the `redux`
package installed. You'll also need the `history` package, which provides
uniform API for navigating between locations across different environments. Read
the ["Usage"](https://www.npmjs.com/package/history#usage) section of their
README to decide how you'd like to create the `history` object (using
`createBrowserHistory`, `createMemoryHistory`, or `createHashHistory`).

### Defining a Router

Let's start by defining a router:

```javascript
import { Router, Route, Redirect, Fallback, Scope } from '@redux-routable/core'

const router = Router([
  Route('home', '/'),
  Scope('/user', Router([
    Route('user', '/:id'),
    Route('friends', '/:id/friends'),
  ])),
  Redirect('user', '/profile/:id'),
  Fallback('notFound'),
])
```

From this configuration, we get an overview of what we can define in our router
with Redux Routable. We have named `Route`s that match on path patterns,
`Redirect`s that take us from a path pattern to a defined route, `Scope`s that
allow us to nest routers, and `Fallback`s that let us match when nothing else
does. For more information, refer to the ["Router Configuration
Constructors"](#router-configuration-constructors) section.

### Creating the Middleware

Now let's create our middleware and create a Redux store with it:

```javascript
import { applyMiddleware, createStore } from 'redux'
import { createMemoryHistory } from 'history'
import { createMiddleware } from '@redux-routable/core'
import reducer from './reducer'

const history = createMemoryHistory()
const middleware = createMiddleware(router, history)
const store = createStore(reducer, applyMiddleware(middleware))
```

### Initializing Your Application with the `SYNC` Action

Now that we have our Redux store, we can dispatch some actions. The first action
we'll want to dispatch is the `SYNC` action provided by Redux Routable:

```javascript
import { sync } from '@redux-routable/core'

store.dispatch(sync())
```

Dispatching the `SYNC` action will cause a `ROUTE_CHANGED` action to be
dispatched that corresponds to the current location:

```javascript
{ type: ROUTE_CHANGED, payload: { route: 'home', params: {}, hash: '' } }
```

Since we're using `createMemoryHistory`, the location defaults to `/`, and the
`ROUTE_CHANGED` action says that the route has been changed to `home`. You'll
want to dispatch the `SYNC` action at the start of your application, so that
reducers and other middleware can synchronize themselves to the current route
and parameters.

### Dispatching Navigation Actions

If we want to programmatically navigate within our application, we can call any
of the navigation actions (`PUSH`, `REPLACE`, `OPEN`, `GO`, `GO_BACK`,
`GO_FORWARD`). We'll use the `PUSH` action as an example:

```javascript
import { push } from '@redux-routable/core'

store.dispatch(push('/user/123'))
```

This will do 2 things:

1. The location will be changed to `/user/123`.
2. A `ROUTE_CHANGED` action will be dispatched:

```javascript
{ type: ROUTE_CHANGED, payload: { route: 'user', params: {}, hash: '' } }
```

All the other navigation actions (with the exception of `OPEN`) will have the
same effect: dispatch a navigation action, the location will change, and a
`ROUTE_CHANGED` action will be dispatched.

### Handling `ROUTE_CHANGED` Actions

In order to use information from the location in your reducers or middleware,
you need to listen to the `ROUTE_CHANGED` action. For example, what if we want a
reducer that stores the ID of a user whenever we navigate to the `user` route,
and clears it whenever we navigate away? Here's how we can do that:

```javascript
import { ROUTE_CHANGED } from '@redux-routable/core'

const reducer = (state, { type, payload }) => {
  if (type === ROUTE_CHANGED) {
    if (payload.route === 'user') {
      return payload.params.id
    } else {
      return null
    }
  } else {
    return state
  }
}
```

This use case is common enough that Redux Routable provides a helper for it:

```javascript
import { routeReducer } from '@redux-routable/core'

const reducer = routeReducer('user', (state, { payload }) => payload.params.id)
```

You can handle `ROUTE_CHANGED` actions however you'd like. You'll likely want to
have a reducer that stores the current route, so that you can render different
views depending on what route you're currently in. It's also useful to kick off
side effects like data fetching from an API whenever a route is navigated to
(using middleware like [`redux-saga`](https://redux-saga.js.org/) or
[`redux-observable`](https://redux-observable.js.org)).

## API

All functions in this section are exported as named exports from the
`@redux-routable/core` module.

### Router Configuration Constructors

The router configuration constructors return objects that hold information about
how to route in your application. Their purpose is to provide declarative
configuration for the middleware.

- `Route(name, [path=''])`

  A `Route` will match when the entire location matches the pattern given by
  `path`.

- `Redirect(to, [path=''])`

  A `Redirect` will match when the entire location matches the pattern given by
  `path`, but the middleware will redirect to the route referenced by `to`.

- `Fallback(name, [path=''])`

  A `Fallback` will match when the beginning of the location matches the pattern
  given by `path`. Since `path` defaults to `''`, if no path is provided, it
  will always match.

- `Scope(base, router)`

  A `Scope` allows you to nest a `Router` within another `Router` by prepending
  a base path to the `path` of each of the routes of the inner `Router`.

- `Router(routes)`

  A `Router` represents the configuration needed by the middleware to enable
  routing with your application. When the location changes, the location will be
  matched against each route in order until a match is found.

The `path` parameter of `Route`, `Redirect`, and `Fallback` is matched with
[`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp). Refer to their
documentation for path syntax.

### Middleware

- `createMiddleware(router, history)`

  This function takes a `Router` as its first parameter and a `history` object
  created using the `history` package. It returns a Redux middleware that can be
  passed to Redux's `applyMiddleware()` function.

### Action Creators

All of the actions created by action creators in this section get "caught" by
the middleware, so they will never reach your reducers or other middleware.

- `sync()`

  Dispatching this action is useful at the very start of your application, as it
  will cause a `ROUTE_CHANGED` action to be dispatched that corresponds to the
  current location, which will give your reducers and other middleware an
  opportunity to synchronize with the current route.

#### Navigation Action Creators

- `push(route, [params={}], [hash=''])`

  Dispatching this action will change the location to match the specified
  `route`, pushing a new entry onto the history stack.

- `replace(route, [params={}], [hash=''])`

  Dispatching this action will change the location to match the specified
  `route`, replacing the current entry on the history stack.

- `open(route, [params={}], [hash=''])`

  Dispatching this action will open a new window or tab to the location
  specified by `route`.

- `go(offset)`

  Dispatching this action will navigate to the location `offset` away from the
  current location on the history stack.

- `goBack()`

  Dispatching this action will navigate to the previous location on the history
  stack.

- `goForward()`

  Dispatching this action will navigate to the next location on the history
  stack.

### Action Types

- `ROUTE_CHANGED`

  An action with this type will be dispatched whenever the location is changed
  (and by dispatching a `SYNC` action). Since all of the navigation actions
  (with the exception of `OPEN`) change the location, you can expect this action
  to be dispatched immediately after dispatching any of those. Actions with type
  `ROUTE_CHANGED` are what you should listen for in your reducers and other
  middleware, and they have this shape:

  ```javascript
  {
    type: ROUTE_CHANGED,
    payload: {
      route: ..., // Route name
      params: { ... }, // Path and query params, string values
      hash: ... // Fragment identifier
    }
  }
  ```

  `payload.params` is populated by both path params (parsed with
  [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)) and query
  params (parsed with
  [`query-string`](https://www.npmjs.com/package/query-string)). Since
  parameters come from the location string, all values will come through as
  strings.

### Helpers

- `routeReducer(route, reducer, [empty=null])`

  This function takes a `route` name, a `reducer` function, and an optional
  `empty` value. It returns a reducer that evaluates the `reducer` function when
  the `route` is navigated to and returns `empty` when the `route` is navigated
  away.

- `isRouteAction(route)`

  This function takes a `route` name and returns a predicate that evaluates to
  `true` when passed a `ROUTE_CHANGED` action that matches the `route` and
  evaluates to `false` otherwise.
