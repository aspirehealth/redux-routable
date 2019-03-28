import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import { act, create } from 'react-test-renderer'
import configureStore from 'redux-mock-store'
import { Route, Router, createMiddleware, routeChanged } from 'redux-routable'
import { Link, Match, Routable } from './index'

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

const mocks = ({ historyOptions, router = mockRouter } = {}) => {
  const history = createMemoryHistory(historyOptions)
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()
  // eslint-disable-next-line react/prop-types
  const Test = ({ children }) => (
    <Provider store={store}>
      <Routable router={router} history={history}>
        {children}
      </Routable>
    </Provider>
  )
  const render = children => create(<Test>{children}</Test>).toJSON()

  window.open = jest.fn()

  return { store, history, window, render, Test }
}

describe('Match', () => {
  test('renders when matched on a single route', () => {
    const { render } = mocks()
    const match = render(<Match route="home">matched</Match>)

    expect(match).toBe('matched')
  })

  test('does not render when not matched on a single route', () => {
    const { render } = mocks()
    const match = render(<Match route="search">matched</Match>)

    expect(match).toBe(null)
  })

  test('renders when matched on multiple routes', () => {
    const { render } = mocks()
    const match = render(<Match route={['home', 'search']}>matched</Match>)

    expect(match).toBe('matched')
  })

  test('does not render when not matched on multiple routes', () => {
    const { render } = mocks()
    const match = render(<Match route={[]}>matched</Match>)

    expect(match).toBe(null)
  })

  test('renders correct content when location is changed', () => {
    let renderer
    const { history, Test } = mocks()
    const element = (
      <Test>
        <Match route="home">home</Match>
        <Match route="search">search</Match>
      </Test>
    )

    act(() => {
      renderer = create(element)
    })

    expect(renderer.toJSON()).toBe('home')
    act(() => history.replace('/search/widgets'))
    expect(renderer.toJSON()).toBe('search')
    act(() => history.replace('/'))
    expect(renderer.toJSON()).toBe('home')
  })
})

describe('Link', () => {
  test('renders <a> element by default', () => {
    const { render } = mocks()
    const link = render(<Link route="home" />)

    expect(link.type).toBe('a')
  })

  test('renders custom component', () => {
    const { render } = mocks()
    const link = render(<Link component="div" route="home" />)

    expect(link.type).toBe('div')
  })

  test('generates correct href', () => {
    const { render } = mocks()
    const link = render(
      <Link
        route="search"
        params={{ category: 'widgets', query: 'devices' }}
        hash="#items"
      />,
    )

    expect(link.props.href).toBe('/search/widgets?query=devices#items')
  })

  test('allows other props to pass through', () => {
    const { render } = mocks()
    const link = render(<Link route="home" extra="extra" />)

    expect(link.props.extra).toBe('extra')
  })

  test('dispatches action when left-clicked', () => {
    const { store, render } = mocks()
    const action = routeChanged('home', {}, '')
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent())

    expect(store.getActions()).toEqual([action])
  })

  test('calls window.open() when left-clicked', () => {
    const { render, window } = mocks()
    const link = render(<Link route="home" action="open" />)

    link.props.onClick(mockEvent())

    expect(window.open).toHaveBeenCalled()
  })

  test('prevents default when left-clicked', () => {
    const { render } = mocks()
    const preventDefault = jest.fn()
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent({ preventDefault }))

    expect(preventDefault).toHaveBeenCalled()
  })

  test('does nothing when non-left-clicked', () => {
    const { store, render } = mocks()
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent({ defaultPrevented: true }))
    link.props.onClick(mockEvent({ button: 1 }))
    link.props.onClick(mockEvent({ metaKey: true }))
    link.props.onClick(mockEvent({ altKey: true }))
    link.props.onClick(mockEvent({ ctrlKey: true }))
    link.props.onClick(mockEvent({ shiftKey: true }))

    expect(store.getActions()).toEqual([])
  })

  test('calls onClick when clicked', () => {
    const { render } = mocks()
    const onClick = jest.fn()
    const event = mockEvent()
    const link = render(<Link route="home" onClick={onClick} />)

    link.props.onClick(event)

    expect(onClick).toHaveBeenCalledWith(event)
  })
})
