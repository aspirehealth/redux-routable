import { createMemoryHistory } from 'history'
import configureStore from 'redux-mock-store'
import {
  NAVIGATE,
  Redirect,
  Route,
  Router,
  Scope,
  createMiddleware,
  replace,
} from './index'

const userRouter = Router([
  Route('users', '/'),
  Route('user', '/:userId'),
  Route('userAdmin', '/admin'),
])

const router = Router([
  Route('home', '/'),
  Route('cart', '/cart'),
  Route('search', '/search/:category?'),
  Route('item', '/item/:itemId'),
  Redirect('/product/:itemId', 'item'),
  Scope('/users', userRouter),
  Route('notFound'),
])

const mocks = (initialEntries = []) => {
  const history = createMemoryHistory({ initialEntries })
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()

  return { store, history }
}

const CHANGING_LOCATION_TESTS = [
  ['/', 'home', {}],
  ['/cart', 'cart', {}],
  ['/search', 'search', {}],
  ['/search/widgets', 'search', { category: 'widgets' }],
  ['/item/123', 'item', { itemId: '123' }],
  ['/product/123', 'item', { itemId: '123' }],
  ['/users', 'users', {}],
  ['/users/456', 'user', { userId: '456' }],
  ['/users/admin', 'userAdmin', {}],
  ['/nonsense', 'notFound', {}],
]

describe('changing location', () => {
  CHANGING_LOCATION_TESTS.forEach(([path, route, params]) => {
    test(`dispatches correct action when changed to '${path}'`, () => {
      const { store, history } = mocks()
      const action = { type: NAVIGATE, payload: { route, params } }

      history.replace(path)
      expect(store.getActions()).toEqual([action])
    })
  })
})

const DISPATCHING_ACTION_TESTS = [
  ['home', undefined, '/'],
  ['cart', undefined, '/cart'],
  ['search', undefined, '/search'],
  ['search', { category: 'widgets' }, '/search/widgets'],
  ['item', { itemId: '123' }, '/item/123'],
  ['users', undefined, '/users'],
  ['user', { userId: '456' }, '/users/456'],
  ['userAdmin', undefined, '/users/admin'],
]

describe('dispatching actions', () => {
  DISPATCHING_ACTION_TESTS.forEach(([route, params, path]) => {
    test(`changes location to '${path}'`, () => {
      const { store, history } = mocks()

      store.dispatch(replace(route, params))
      expect(history.location.pathname + history.location.search).toBe(path)
    })
  })
})
