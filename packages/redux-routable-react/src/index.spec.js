import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import TestRenderer from 'react-test-renderer'
import configureStore from 'redux-mock-store'
import { Route, Router, createMiddleware, routeChanged } from 'redux-routable'
import { Link, RouterProvider } from './index'

const mockRouter = Router([
  Route('home', '/'),
  Route('search', '/search/:category?'),
])

const mockEvent = properties => ({
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  preventDefault: () => {},
  ...properties,
})

const mocks = ({ router = mockRouter } = {}) => {
  const history = createMemoryHistory()
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()
  const create = children =>
    TestRenderer.create(
      <Provider store={store}>
        <RouterProvider router={router}>{children}</RouterProvider>
      </Provider>,
    ).toJSON()

  window.open = jest.fn()

  return { store, history, window, create }
}

describe('Link', () => {
  test('renders <a> element by default', () => {
    const { create } = mocks()
    const link = create(<Link route="home" />)

    expect(link.type).toBe('a')
  })

  test('renders custom component', () => {
    const { create } = mocks()
    const link = create(<Link component="div" route="home" />)

    expect(link.type).toBe('div')
  })

  test('generates correct href', () => {
    const { create } = mocks()
    const link = create(
      <Link
        route="search"
        params={{ category: 'widgets', query: 'devices' }}
        hash="#items"
      />,
    )

    expect(link.props.href).toBe('/search/widgets?query=devices#items')
  })

  test('allows other props to pass through', () => {
    const { create } = mocks()
    const link = create(<Link route="home" extra="extra" />)

    expect(link.props.extra).toBe('extra')
  })

  test('dispatches action when left-clicked', () => {
    const { store, create } = mocks()
    const action = routeChanged('home', {}, '')
    const link = create(<Link route="home" />)

    link.props.onClick(mockEvent())

    expect(store.getActions()).toEqual([action])
  })

  test('calls window.open() when left-clicked', () => {
    const { create, window } = mocks()
    const link = create(<Link route="home" action="open" />)

    link.props.onClick(mockEvent())

    expect(window.open).toHaveBeenCalled()
  })

  test('prevents default when left-clicked', () => {
    const { create } = mocks()
    const preventDefault = jest.fn()
    const link = create(<Link route="home" />)

    link.props.onClick(mockEvent({ preventDefault }))

    expect(preventDefault).toHaveBeenCalled()
  })

  test('does nothing when non-left-clicked', () => {
    const { store, create } = mocks()
    const link = create(<Link route="home" />)

    link.props.onClick(mockEvent({ defaultPrevented: true }))
    link.props.onClick(mockEvent({ button: 1 }))
    link.props.onClick(mockEvent({ metaKey: true }))
    link.props.onClick(mockEvent({ altKey: true }))
    link.props.onClick(mockEvent({ ctrlKey: true }))
    link.props.onClick(mockEvent({ shiftKey: true }))

    expect(store.getActions()).toEqual([])
  })

  test('calls onClick when clicked', () => {
    const { create } = mocks()
    const onClick = jest.fn()
    const event = mockEvent()
    const link = create(<Link route="home" onClick={onClick} />)

    link.props.onClick(event)

    expect(onClick).toHaveBeenCalledWith(event)
  })
})
