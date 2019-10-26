# Redux Routable

A simple [Redux middleware](https://redux.js.org/advanced/middleware) for
routing. Define the routes of your application, dispatch actions to navigate,
and actions will be dispatched whenever the route changes.

## Overview

- Use [declarative functions](#router-configuration-constructors) to define your
  router.
- Dispatch [navigation actions](#navigation-action-creators) to change the
  location, open a route in a new tab, or go back or forward in history.
- Listen for the [`ROUTE_CHANGED`](#action-types) action in your reducers to
  persist state and execute side effects for the route, parameters, and hash.

## Installation

```shell
npm install --save redux-routable
```

Along with installing this package, you'll also need to have
[`redux`](https://www.npmjs.com/package/redux) and
[`history`](https://www.npmjs.com/package/history) installed.

## Usage

Given that Redux Routable is a Redux middleware, you'll need to have the `redux`
package installed. You'll also need the `history` package, which provides
uniform API for navigating between locations across different environments. Read
the
["Intro"](https://github.com/ReactTraining/history/blob/master/docs/GettingStarted.md#intro)
section of their docs to decide how you'd like to create the `history` object
(using `createBrowserHistory`, `createMemoryHistory`, or `createHashHistory`).

### Defining a Router

Let's start by defining a router:

```javascript
import { Router, Route, Redirect, Fallback, Scope } from 'redux-routable'

const router = Router([
  Route('home', '/'),
  Scope('/user', Router([
    Route('user', '/:id'),
    Route('friends', '/:id/friends')
  ])),
  Redirect('user', '/profile/:id'),
  Fallback('notFound')
])
```

From this configuration, we get an overview of what we can define in our router
with Redux Routable. We have named `Route`s that match on path patterns,
`Redirect`s that take us from a path pattern to a defined route, `Scope`s that
allow us to nest `Router`s, and `Fallback`s that let us match when nothing else
does. For more information, refer to the ["Router Configuration
Constructors"](#router-configuration-constructors) section.

### Creating the Middleware

Now let's create our middleware and create a Redux store with it:

```javascript
import { applyMiddleware, createStore } from 'redux'
import { createMemoryHistory } from 'history'
import { createMiddleware } from 'redux-routable'
import reducer from './reducer'

const history = createMemoryHistory()
const middleware = createMiddleware(router, history)
const store = createStore(reducer, applyMiddleware(middleware))
```

### Initializing Your Application with the `SYNC` Action

Now that we have our Redux store, we can dispatch some actions. The first action
we'll want to dispatch is the `SYNC` action provided by Redux Routable, which we
can create with the `sync` [action
creator](https://redux.js.org/basics/actions#action-creators):

```javascript
import { sync } from 'redux-routable'

store.dispatch(sync())
```

Dispatching the `SYNC` action will cause a `ROUTE_CHANGED` action to be
dispatched that corresponds to the current location:

```javascript
{
  type: ROUTE_CHANGED,
  payload: { route: 'home', params: {}, hash: '' },
  meta: { previous: undefined }
}
```

Since we're using `createMemoryHistory`, the location defaults to `/`, and the
`ROUTE_CHANGED` action says that the route has been changed to `home`. You'll
want to dispatch the `SYNC` action at the start of your application, so that
reducers and other middleware can synchronize themselves to the current route,
parameters, and hash.

### Dispatching Navigation Actions

If we want to programmatically navigate within our application, we can dispatch
any of the navigation actions (`PUSH`, `REPLACE`, `OPEN`, `GO`, `GO_BACK`,
`GO_FORWARD`). Just like the `SYNC` action, these actions can only be created
with their corresponding action creators. We'll use the `PUSH` action as an
example:

```javascript
import { push } from 'redux-routable'

store.dispatch(push('user', { id: '123' }))
```

This will do 2 things:

1. The location will be changed to `/user/123`.
2. A `ROUTE_CHANGED` action will be dispatched:

```javascript
{
  type: ROUTE_CHANGED,
  payload: { route: 'user', params: { id: '123' }, hash: '' },
  meta: { previous: { route: 'home', params: {}, hash: '' } }
}
```

All of the other navigation actions (with the exception of `OPEN`) will have the
same flow:

- Dispatch a navigation action.
- The location will be changed.
- A `ROUTE_CHANGED` action will be dispatched.

The `OPEN` action is an exception to this flow, as dispatching this action will
cause a new window or tab to be opened instead of changing the location.

### Handling `ROUTE_CHANGED` Actions

In order to use information from the location (route, params, and hash) in your
reducers or middleware, you need to listen to the `ROUTE_CHANGED` action that
gets dispatched by the middleware. If we want to keep track of the current
route, we can do so easily:

```javascript
import { ROUTE_CHANGED } from 'redux-routable'

const currentRouteReducer = (state, { type, payload }) => {
  if (type === ROUTE_CHANGED) {
    return payload.route
  } else {
    return state
  }
}
```

What if we want a reducer that stores the ID of a user whenever we navigate to
the `user` route, and clears it whenever we navigate away? Here's how we can do
that:

```javascript
import { ROUTE_CHANGED } from 'redux-routable'

const userIdReducer = (state, { type, payload }) => {
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

This use case is common enough, and reducers like this will likely be written
repeatedly, so Redux Routable provides a helper for it:

```javascript
import { paramsReducer } from 'redux-routable'

const userIdReducer = paramsReducer('user', ({ id }) => id)
```

Redux Routable comes with some other helpers as well. The `changedTo` function
determines if an action is a `ROUTE_CHANGED` action for a specific `route`. This
can be useful to kick off side effects like loading data from an API whenever a
specific route or routes are navigated to. There are also the `entered` and
`exited` functions, which look at `meta.previous` to determine whether you're
going "from" or "to" a specific route or routes. These can be useful for page
transitions or loading/clearing data common to a set of routes.

Even though these helper functions cover some common use cases, you can handle
`ROUTE_CHANGED` actions however you'd like. Redux Routable does not prescribe
how you store your routing data or how you manage side effects.

### Handling `ROUTE_NOT_MATCHED` and `LOCATION_NOT_MATCHED` Actions

Sometimes, things don't go exactly as planned, whether it's because of developer
or user error. Redux Routable provides a couple of actions that allow you to
handle errors related to routing.

The `ROUTE_NOT_MATCHED` action is dispatched whenever a navigation action is
dispatched but the route that it specifies cannot be matched to a route in
configuration. This is usually because a developer has passed a `route` to a
navigation action creator that doesn't exist in the router configuration. It
also might be because the `params` passed to a navigation action creator are
somehow invalid, as in a missing parameter or a parameter of the wrong type.

The `LOCATION_NOT_MATCHED` action is dispatched whenever the location is changed
but that location cannot be matched to a route in configuration. Since the user
is allowed to change the location to whatever they'd like, this action is likely
going to be dispatched, so it's a good idea to handle it. It's worth noting,
however, that if you have a `Fallback` without a `path` in your top-level
`Router`, then this action will never be dispatched, since that `Fallback` will
match any location. Whether you have a top-level `Fallback` should be determined
by whether you want to treat the user navigating to a "not found" route as an
error condition or a normal part of the application.

The shape of both of these actions is documented in the ["Action
Types"](#action-types) section.

## API

All functions in this section are exported as named exports from the
`redux-routable` package.

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
  a base path to the `path` of each of the children of the inner `Router`.

- `Router(children)`

  A `Router` represents the configuration needed by the middleware to enable
  routing with your application. When the location changes, the location will be
  matched against each child in order until a match is found. Any instance of
  the above router configuration functions are valid `Router` children.

The `path` parameter of `Route`, `Redirect`, and `Fallback` is matched with
[`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp). Refer to their
documentation for path syntax.

### Middleware

- `createMiddleware(router, history)`

  This function takes a `Router` as its first parameter and a `history` object
  created using the `history` package. It returns a Redux middleware that can be
  passed to Redux's `applyMiddleware()` function.

### Action Creators

Actions created by action creators in this section get "caught" by the
middleware in order to execute navigation side effects. They do not have their
types exposed as they are not meant to be handled by your reducers or other
middleware.

- `sync()`

  Dispatching this action is useful at the start of your application, as it will
  cause a `ROUTE_CHANGED` action to be dispatched that corresponds to the
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

Actions with types in this section are created and dispatched by the middleware
and are intended to be handled by your reducers or other middleware. They do not
have action creators exposed as they are not meant to be manually constructed.

- `ROUTE_CHANGED`

  An action with this type will be dispatched whenever the location is changed
  (and by dispatching a `SYNC` action) and the location is able to be matched
  with a route from the router configuration. Since all of the navigation
  actions (with the exception of `OPEN`) change the location, you can expect
  this action to be dispatched immediately after dispatching any of those.
  Actions with type `ROUTE_CHANGED` are what you should listen for in your
  reducers and other middleware, and they have this shape:

  ```javascript
  {
    type: ROUTE_CHANGED,
    payload: {
      route: ..., // Route name
      params: { ... }, // Path and query params
      hash: ... // Fragment identifier
    },
    meta: {
      previous: ... // Payload of previous ROUTE_CHANGED action
    }
  }
  ```

  `payload.params` is populated by both path params (parsed with
  [`path-to-regexp`](https://www.npmjs.com/package/path-to-regexp)) and query
  params (parsed with
  [`query-string`](https://www.npmjs.com/package/query-string)).

- `ROUTE_NOT_MATCHED`

  An action with this type will be dispatched whenever a `PUSH`, `REPLACE`, or
  `OPEN` navigation action is dispatched and the provided `route` or `params` is
  not able to be matched with a route in the router configuration. The `message`
  of the `RouteMatchError` in the payload will state the reason that the route
  could not be matched. These actions have this shape:

  ```javascript
  {
    type: ROUTE_NOT_MATCHED,
    error: true,
    payload: ..., // RouteMatchError
    meta: {
      route: ...,
      params: { ... },
      hash: ...
    }
  }
  ```

  `meta` will have the same properties as the `payload` of the `ROUTE_CHANGED`
  action above.

- `LOCATION_NOT_MATCHED`

  An action with this type will be dispatched whenever the location is changed
  (and by dispatching a `SYNC` action) and the location is not able to be
  matched with a route from the router configuration. This action will only end
  up being dispatched if you do not have a `Fallback` without a `path` in your
  top-level `Router`. These actions have this shape:

  ```javascript
  {
    type: LOCATION_NOT_MATCHED,
    error: true,
    payload: ..., // LocationMatchError
    meta: {
      location: { ... }
    }
  }
  ```

  `meta.location` will be the location that failed to match as provided by the
  `history` package. Read the
  ["Properties"](https://github.com/ReactTraining/history/blob/master/docs/GettingStarted.md#properties)
  section of their README to see the properties on this object.

### Helpers

- `match(route, matchable)`

  This function will return whether a `route` matches a `matchable`.

- `paramsReducer(matchable, [awayVal=null], paramsSelector)`

  This function creates a reducer that evaluates `paramsSelector` against the
  `payload.params` of a `ROUTE_CHANGED` action when navigated to the specified
  `matchable`. When navigated away from `matchable`, the reducer will evaluate
  to `awayVal`.

- `changedTo(matchable)`

  This function takes a "matchable" and returns a predicate that evaluates to
  `true` when passed a `ROUTE_CHANGED` action that matches `matchable` and
  evaluates to `false` otherwise.

- `entered(matchable)`

  This function takes a "matchable" and returns a predicate that evaluates to
  `true` when passed a `ROUTE_CHANGED` action where `matchable` was "entered"
  (the previous `ROUTE_CHANGED` action does not match `matchable`, but the
  current one does) and evaluates to `false` otherwise.

- `exited(matchable)`

  This function takes a "matchable" and returns a predicate that evaluates to
  `true` when passed a `ROUTE_CHANGED` action where `matchable` was "exited"
  (the previous `ROUTE_CHANGED` action matches `matchable`, but the current one
  does not) and evaluates to `false` otherwise.

The `matchable` parameter of all of the helper functions can be either a route
name, an array of route names, or a Redux Routable config object.
