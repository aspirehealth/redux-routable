# Redux Routable React

[React](https://reactjs.org/) components that integrate with [Redux
Routable](https://www.npmjs.com/package/redux-routable). Render content based on
the current route, and declaratively link to different routes.

## Overview

- Conditionally render content depending on the current route with the
  [`<Match>`](#match) component.
- Navigate to locations within your application declaratively with the
  [`<Link>`](#link) component.

## Installation

```shell
npm install --save redux-routable-react
```

The `redux-routable-react` package is meant to be installed along with the
[`redux-routable`](https://www.npmjs.com/package/redux-routable#installation)
package.

## Usage

Redux Routable React is a companion package for integrating React and Redux
Routable. This means that before using Redux Routable React, you need create a
`router` and a `history` object. See how to do that in Redux Routable's
["Usage"](https://www.npmjs.com/package/redux-routable#usage) section. For
brevity, let's just define a router and leave out the rest of the setup:

```javascript
import { Router, Route } from 'redux-routable'

const router = Router([
  Route('home', '/'),
  Route('cart', '/cart'),
  Route('search', '/search/:category?')
])
```

### Initial Setup with the `<Routable>` Component

In order to use the `<Match>` and `<Link>` components throughout your
application, you need to render the `<Routable>` component at the root of your
application:

```javascript
import React from 'react'
import ReactDOM from 'react-dom'
import { Routable } from 'redux-routable-react'
import { router, history } from './setup'
import App from './App'

const rootElement = document.getElementById('root')

ReactDOM.render(
  <Routable router={router} history={history}>
    <App />
  </Routable>,
  rootElement
)
```

### Using the `<Match>` Component

You can use the `<Match>` component to conditionally render content based on the
current route. Just pass a route name into the `on` prop to match on a specific
route:

```javascript
const App = () => (
  <React.Fragment>
    <Match on="home">I am on the home page!</Match>
    <Match on="cart">I am on the cart page!</Match>
  </React.Fragment>
)
```

So, if the location was `/`, you would see `I am on the home page!`, and if the
location was `/cart`, you would see `I am on the cart page!`.

You can also pass an array of route names to the `on` prop to match on multiple
routes:

```javascript
const App = () => (
  <React.Fragment>
    <Match on="home">I am on the home page!</Match>
    <Match on={['cart', 'search']}>I am on another page!</Match>
  </React.Fragment>
)
```

Now, if the location was `/`, you would still see `I am on the home page!`, but
if the location was `/cart` or `/search/widgets`, you would see `I am on another
page!`.

### Using the `<Link>` Component

The `<Link>` component can be used to render links that navigate around your
application by route instead of by URL:

```javascript
const App = () => (
  <React.Fragment>
    <Link route="home">Go Home</Link>
    <Link route="cart" hash="#saved">Go to Cart</Link>
    <Link route="search" params={{ category: 'widgets' }}>
      Search for Widgets
    </Link>
  </React.Fragment>
)
```

This would render the following HTML:

```html
<a href="/">Go Home</a>
<a href="/cart#saved">Go to Cart</a>
<a href="/search/widgets">Search for Widgets</a>
```

As you can see, `<Link>` will render an `<a>` element, and the `href` attribute
is set according to the `route`, `params`, and `hash` that were provided.

These links will function exactly like normal `<a>` links, except that when
clicked with a normal left-click (no modifier keys held down), instead of
navigating to a new page using standard browser behavior, a Redux Routable
navigation action will be dispatched (`PUSH` by default, configurable through
the `action` prop). This means that either the location will change without a
page load (when `action="push"` or `action="replace"`) or a new tab will be
opened (when `action="open"`), and your reducers and middleware will receive the
`ROUTE_CHANGED` action.

It's possible that either the `route` or `params` that you pass to a `<Link>`
will not match with a route in the router configuration. If that is the case, an
error will be logged, and the component will simply render `null`.

## API

All components in this section are exported as named exports from the
`redux-routable-react` package.

### `<Routable>`

Component used to provide `router` and `history` to the rest of the application.

#### Props

| Name         | Type     | Description                                                                         |
| ------------ | -------- | ----------------------------------------------------------------------------------- |
| `router *`   | `object` | The router created using `Router` from the `redux-routable` package.                |
| `history *`  | `object` | The object returned using one of the `create` functions from the `history` package. |
| `children *` | `node`   | The children to be rendered.                                                        |

### `<Match>`

Component used to conditionally render content depending on the current route.

#### Props

| Name         | Type   | Description                                                                                                                    |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `on *`       | `any`  | A "matchable" value (route name, array of route names, or Redux Routable config object) to match against the current location. |
| `children *` | `node` | The children to be rendered if `on` matches the current location.                                                              |

### `<Link>`

Component used to render links that can be used to navigate around the
application.

#### Props

| Name      | Type                            | Default  | Description                                         |
| --------- | ------------------------------- | -------- | --------------------------------------------------- |
| `route *` | `any`                           |          | The name of the route to navigate to.               |
| `params`  | `object{any}`                   | `{}`     | The params of the route to navigate to.             |
| `hash`    | `string`                        | `""`     | The hash of the route to navigate to.               |
| `action`  | `"push" \| "replace" \| "open"` | `"push"` | The Redux Routable action to dispatch when clicked. |

Any other props will be passed to the root `<a>` element.
